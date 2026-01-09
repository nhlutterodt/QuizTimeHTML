// Minimal server.js - supports CSV upload with headersMap and preset
const express = require('express');
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const UploadIdempotencyService = require('./src/services/UploadIdempotencyService.cjs');
const { createApiKeyGuard, createRateLimiter, enforceRowLimit, enforceTotalSize } = require('./src/services/uploadGuards.cjs');
const {
  logEvent,
  getMetricsSnapshot,
  recordUploadSuccess,
  recordUploadFailure,
  recordUploadReuse,
  recordParseReportDownload,
  recordAuthFailure,
  recordRateLimited,
  recordCleanupRun
} = require('./src/services/observability.cjs');
let integratedManager = null;
let idempotencyService = null;

const app = express();

const USER_DATA_FILE = path.join(__dirname, 'user_data.json');
const QUESTION_BANK_FILE = path.join(__dirname, 'data', 'question_bank.json');
const BACKUPS_DIR = path.join(__dirname, 'data', 'backups');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const UPLOAD_API_KEY = process.env.UPLOAD_API_KEY || null;
const PARSE_REPORT_API_KEY = process.env.PARSE_REPORT_API_KEY || UPLOAD_API_KEY;
const UPLOAD_RATE_LIMIT_MAX = Number(process.env.UPLOAD_RATE_LIMIT_MAX || 20);
const UPLOAD_RATE_LIMIT_WINDOW_MS = Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const REPORT_RATE_LIMIT_MAX = Number(process.env.REPORT_RATE_LIMIT_MAX || 30);
const REPORT_RATE_LIMIT_WINDOW_MS = Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const UPLOAD_ROW_LIMIT = Number(process.env.UPLOAD_ROW_LIMIT || 5000);
const UPLOAD_MAX_TOTAL_MB = Number(process.env.UPLOAD_MAX_TOTAL_MB || 25);
const UPLOAD_MAX_TOTAL_BYTES = UPLOAD_MAX_TOTAL_MB * 1024 * 1024;
const AUDIT_MAX_MB = Number(process.env.AUDIT_MAX_MB || 5);
const AUDIT_MAX_BYTES = AUDIT_MAX_MB * 1024 * 1024;
const IDEMPOTENCY_MAX_RECORDS = Number(process.env.IDEMPOTENCY_MAX_RECORDS || 2000);
const TEMP_RETENTION_DAYS = Number(process.env.TEMP_RETENTION_DAYS || 7);
const TEMP_CLEAN_INTERVAL_MS = Number(process.env.TEMP_CLEAN_INTERVAL_MS || 6 * 60 * 60 * 1000);
const REQUEST_LOG_ENABLED = process.env.REQUEST_LOG_ENABLED !== 'false';

let userData = { users: [], sessions: [], responses: [] };
let questionBank = { questions: [], uploads: [], metadata: {} };

async function loadUserData() { try { const data = await fs.readFile(USER_DATA_FILE, 'utf8'); userData = JSON.parse(data); } catch (e) { await saveUserData(); } }
async function saveUserData() { try { await fs.writeFile(USER_DATA_FILE, JSON.stringify(userData, null, 2)); } catch (e) { console.error('saveUserData failed', e); } }
async function loadQuestionBank() { try { const data = await fs.readFile(QUESTION_BANK_FILE, 'utf8'); questionBank = JSON.parse(data); } catch (e) { await saveQuestionBank(); } }
async function saveQuestionBank() { questionBank.metadata.lastUpdated = new Date().toISOString(); questionBank.metadata.totalQuestions = questionBank.questions.length; await fs.writeFile(QUESTION_BANK_FILE, JSON.stringify(questionBank, null, 2)); }
async function createBackup() { try { const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); const backupFile = path.join(BACKUPS_DIR, `question_bank_${timestamp}.json`); await fs.writeFile(backupFile, JSON.stringify(questionBank, null, 2)); return backupFile; } catch (e) { console.error('createBackup failed', e); } }

async function ensureUploadsDir() {
  try { await fs.mkdir(UPLOADS_DIR, { recursive: true }); } catch (e) { console.error('ensureUploadsDir failed', e); }
}

async function cleanupUploadedFiles(files = []) {
  for (const f of files) {
    try { await fs.unlink(f.path); } catch (e) { /* best-effort cleanup */ }
  }
}

async function cleanupStaleUploads(retentionMs) {
  if (!Number.isFinite(retentionMs) || retentionMs <= 0) return;
  let deleted = 0;
  try {
    const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
    const cutoff = Date.now() - retentionMs;
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      if (['idempotency.json', 'audit.log', 'audit.log.bak'].includes(entry.name)) continue;
      const fullPath = path.join(UPLOADS_DIR, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(fullPath);
          deleted += 1;
        }
      } catch (e) {
        /* ignore per-file errors */
      }
    }
    recordCleanupRun(deleted, { retentionMs });
    if (REQUEST_LOG_ENABLED && deleted) {
      logEvent('uploads_cleanup', { deletedFiles: deleted, retentionMs });
    }
  } catch (e) {
    if (REQUEST_LOG_ENABLED) logEvent('uploads_cleanup_error', { error: e.message });
  }
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Simple CSV parser (small, not full CSV spec)
function parseCSVLine(line) { const result = []; let cur=''; let inQ=false; for (let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"') inQ=!inQ; else if(ch===',' && !inQ){ result.push(cur.trim().replace(/^"|"$/g,'')); cur=''; } else cur+=ch;} result.push(cur.trim().replace(/^"|"$/g,'')); return result; }
function parseCSVContent(text){ const lines = text.split('\n').map(l=>l.trim()).filter(Boolean); if(!lines.length) return { headers:[], rows:[] }; const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'')); const rows=[]; for(let i=1;i<lines.length;i++){ const cols=parseCSVLine(lines[i]); if(cols.length===headers.length){ const obj={}; headers.forEach((h,idx)=>obj[h]=cols[idx]); rows.push(obj); } } return { headers, rows }; }

function convertToQuestionFormat(csvRow, uploadId, rowIndex, filename){ return { id: csvRow.id?parseInt(csvRow.id):null, category: csvRow.category||'General', difficulty: csvRow.difficulty||'Medium', type: csvRow.type||'multiple_choice', question: csvRow.question, option_a: csvRow.option_a, option_b: csvRow.option_b, option_c: csvRow.option_c, option_d: csvRow.option_d, correct_answer: csvRow.correct_answer, explanation: csvRow.explanation||'', points: parseInt(csvRow.points)||1, time_limit: parseInt(csvRow.time_limit)||30, source:{ uploadId, filename, rowIndex, originalId: csvRow.id, uploadedAt: new Date().toISOString() } }; }

function findDuplicate(newQ, existing){ if(newQ.id){ const m=existing.find(q=>q.id===newQ.id); if(m) return {type:'id', question:m}; } const norm=(newQ.question||'').toLowerCase().trim(); const t=existing.find(q=> (q.question||'').toLowerCase().trim()===norm); if(t) return {type:'text', question:t}; return null; }

function applyMergeStrategy(newQ, existingQ, strategy){ switch(strategy){ case 'skip': return null; case 'overwrite': return {...newQ, source: existingQ.source}; case 'force': { const maxId = Math.max(0, ...questionBank.questions.map(q=>q.id||0)); return {...newQ, id: maxId+1}; } case 'merge': return {...existingQ, ...Object.fromEntries(Object.entries(newQ).filter(([k,v])=>v!=='' && v!=null && k!=='source')), source: existingQ.source}; default: return null; } }

function getActorMeta(req) {
  return {
    userId: req.header('x-user-id') || 'anonymous',
    sessionId: req.header('x-session-id') || 'anonymous'
  };
}

app.use((req, res, next) => {
  req.requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  req.actor = getActorMeta(req);
  req._startAt = Date.now();
  if (REQUEST_LOG_ENABLED) {
    logEvent('request_received', { requestId: req.requestId, method: req.method, path: req.originalUrl, ...req.actor });
  }
  next();
});

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 10 * 1024 * 1024, files: 5 } });
const uploadAuthGuard = createApiKeyGuard(UPLOAD_API_KEY, { onFailure: (req) => recordAuthFailure('upload', { requestId: req.requestId, ...req.actor }) });
const uploadRateLimiter = createRateLimiter({ windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS, maxRequests: UPLOAD_RATE_LIMIT_MAX, namespace: 'upload', onLimit: (req) => recordRateLimited('upload', { requestId: req.requestId, ...req.actor }) });
const reportAuthGuard = createApiKeyGuard(PARSE_REPORT_API_KEY, { onFailure: (req) => recordAuthFailure('report', { requestId: req.requestId, ...req.actor }) });
const reportRateLimiter = createRateLimiter({ windowMs: REPORT_RATE_LIMIT_WINDOW_MS, maxRequests: REPORT_RATE_LIMIT_MAX, namespace: 'parse-report', onLimit: (req) => recordRateLimited('report', { requestId: req.requestId, ...req.actor }) });
const uploadProcessor = require('./src/services/uploadProcessor');

app.get('/api/question-bank/stats', (req,res)=>{ res.json({ totalQuestions: questionBank.questions.length, totalUploads: questionBank.uploads.length }); });

app.use(express.static(path.join(__dirname)));

// Validate OpenAI API key by making a lightweight test request
async function validateOpenAIKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };

  try {
    console.log('🔍 Validating OpenAI API key...');
    const testPayload = {
      model: 'gpt-3.5-turbo',
      messages: [ { role: 'user', content: 'Test message' } ],
      max_tokens: 5
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(testPayload)
    });

    if (response.ok) {
      console.log('✅ OpenAI API key validated successfully');
      return { valid: true, error: null };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ OpenAI API key validation failed:', response.status, errorData);
      return { valid: false, error: `API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}` };
    }
  } catch (error) {
    console.error('❌ OpenAI validation network error:', error);
    return { valid: false, error: `Network error: ${error.message}` };
  }
}

async function validateGeminiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  
  try {
    console.log('🔍 Validating Gemini API key...');
    const testPayload = {
      contents: [{
        parts: [{ text: 'Test message' }]
      }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (response.ok) {
      console.log('✅ Gemini API key validated successfully');
      return { valid: true, error: null };
    } else {
      const errorData = await response.json();
      console.log('❌ Gemini API key validation failed:', response.status, errorData);
      return { 
        valid: false, 
        error: `API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}` 
      };
    }
  } catch (error) {
    console.error('❌ Gemini validation network error:', error);
    return { valid: false, error: `Network error: ${error.message}` };
  }
}

async function validateAPIKey(apiKey, provider) {
  switch (provider) {
    case 'openai':
      return await validateOpenAIKey(apiKey);
    case 'gemini':
      return await validateGeminiKey(apiKey);
    default:
      return { valid: false, error: 'Unsupported provider' };
  }
}

// Serve static files (so you can open http://localhost:3000/User_Acceptance.html)
app.use(express.static(path.join(__dirname)));

// API key management endpoint
app.post('/api/configure-key', async (req, res) => {
  console.log('🔑 Received API key configuration request:', {
    method: req.method,
    url: req.url,
    provider: req.body?.provider,
    action: req.body?.action,
    hasApiKey: !!req.body?.apiKey
  });
  
  try {
    const { apiKey, provider, action } = req.body;
    
    if (!provider || !['openai', 'gemini'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider. Must be "openai" or "gemini"' });
    }
    
    if (action === 'validate') {
      const validation = await validateAPIKey(apiKey, provider);
      if (validation.valid) {
        // Update global configuration
        CURRENT_API_KEY = apiKey;
        CURRENT_PROVIDER = provider;
        USE_AI = true;
        AI_STATUS = {
          available: true,
          lastChecked: new Date().toISOString(),
          error: null,
          checking: false,
          provider: provider
        };
        
        console.log(`✅ ${provider.toUpperCase()} API key configured successfully`);
      }
      res.json({
        valid: validation.valid,
        error: validation.error,
        aiStatus: AI_STATUS
      });
    } else if (action === 'save') {
      // For production, encrypt and save to user session/database
      encryptApiKey(apiKey);
      console.log(`🔐 ${provider.toUpperCase()} API key encrypted and ready for storage`);
      res.json({ success: true, message: `${provider.toUpperCase()} API key secured` });
    } else {
      res.status(400).json({ error: 'Invalid action. Must be "validate" or "save"' });
    }
  } catch (error) {
    console.error('🔑 API key configuration error:', error);
    res.status(500).json({ error: 'Configuration failed' });
  }
});

// AI availability status endpoint
app.post('/api/ai-status', async (req, res) => {
  if (AI_STATUS.checking) {
    return res.json(AI_STATUS);
  }

  // Check if we need to revalidate (every 5 minutes)
  const shouldRecheck = !AI_STATUS.lastChecked || 
    (Date.now() - new Date(AI_STATUS.lastChecked).getTime()) > 5 * 60 * 1000;

  if (shouldRecheck && CURRENT_API_KEY && CURRENT_PROVIDER) {
    AI_STATUS.checking = true;
    const validation = await validateAPIKey(CURRENT_API_KEY, CURRENT_PROVIDER);
    AI_STATUS = {
      available: validation.valid,
      lastChecked: new Date().toISOString(),
      error: validation.error,
      checking: false,
      provider: CURRENT_PROVIDER
    };
  }

  res.json(AI_STATUS);
});

// AI Assessment function supporting multiple providers
async function getAIAssessment(questionText, userAnswerArray, correctAnswerArray) {
  if (!USE_AI || !CURRENT_API_KEY || !CURRENT_PROVIDER) {
    throw new Error('AI not configured');
  }

  const systemPrompt = 'You are an expert tutor. Provide a concise (2-4 sentence) assessment in plain language explaining whether the user\'s answer is correct and why. If incorrect, briefly explain the correct reasoning.';
  const userPrompt = `Question: ${questionText}\nUser answer: ${userAnswerArray.join(', ') || 'None'}\nCorrect answer: ${correctAnswerArray.join(', ')}`;

  console.log(`🤖 Calling ${CURRENT_PROVIDER.toUpperCase()} API...`);

  if (CURRENT_PROVIDER === 'openai') {
    return await callOpenAI(systemPrompt, userPrompt);
  } else if (CURRENT_PROVIDER === 'gemini') {
    return await callGemini(systemPrompt, userPrompt);
  } else {
    throw new Error('Unsupported AI provider');
  }
}

async function callOpenAI(systemPrompt, userPrompt) {
  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 200,
    temperature: 0.2
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CURRENT_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  
  if (!response.ok) {
    const error = new Error(`OpenAI API Error: ${response.status}`);
    error.status = response.status;
    error.provider = 'openai';
    error.apiError = body.error;
    error.body = body;
    throw error;
  }

  return body.choices[0]?.message?.content || 'Unable to generate assessment.';
}

async function callGemini(systemPrompt, userPrompt) {
  const payload = {
    contents: [{
      parts: [{ 
        text: `${systemPrompt}\n\n${userPrompt}` 
      }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 200
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${CURRENT_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  
  if (!response.ok) {
    const error = new Error(`Gemini API Error: ${response.status}`);
    error.status = response.status;
    error.provider = 'gemini';
    error.apiError = body.error;
    error.body = body;
    throw error;
  }

  return body.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate assessment.';
}

app.post('/api/assess', async (req, res) => {
  try {
    const { questionText, userAnswerArray = [], correctAnswerArray = [], userId, sessionId } = req.body || {};
    
    console.log('📝 Assessment request:', {
      useAI: USE_AI,
      provider: CURRENT_PROVIDER,
      questionLength: (questionText || '').length,
      userId: userId || 'anonymous',
      sessionId: sessionId || 'no-session'
    });

    if (!questionText) {
      return res.status(400).json({ error: 'Missing questionText' });
    }

    // Log user interaction
    const responseData = {
      timestamp: new Date().toISOString(),
      userId: userId || 'anonymous',
      sessionId: sessionId || crypto.randomUUID(),
      questionText: questionText.slice(0, 200),
      userAnswer: userAnswerArray.join(', '),
      correctAnswer: correctAnswerArray.join(', '),
      aiUsed: USE_AI,
      provider: CURRENT_PROVIDER
    };

    // If no AI is configured, return mock assessment
    if (!USE_AI || !CURRENT_API_KEY) {
      const mockAssessment = `✏️ PRACTICE MODE: Your answer "${userAnswerArray.join(', ') || 'None'}" compared to correct answer "${correctAnswerArray.join(', ')}". Configure AI for detailed feedback.`;
      responseData.assessment = mockAssessment;
      responseData.aiUsed = false;
      
      userData.responses.push(responseData);
      await saveUserData();
      
      await ensureUploadsDir();
      return res.json({ 
        assessment: mockAssessment,
        practiceMode: true,
        sessionId: responseData.sessionId
      });
    }

    try {
      const assessment = await getAIAssessment(questionText, userAnswerArray, correctAnswerArray);
      
      responseData.assessment = assessment;
      userData.responses.push(responseData);
      await saveUserData();

      res.json({
        assessment: assessment,
        practiceMode: false,
        sessionId: responseData.sessionId,
        provider: CURRENT_PROVIDER
      });

    } catch (apiError) {
      console.error(`❌ ${apiError.provider?.toUpperCase() || 'AI'} API Error:`, apiError);
      
      // Enhanced error handling with user-friendly messages
      let userMessage;
      let logMessage;
      
      switch (apiError.status) {
        case 401:
          userMessage = '🔑 AI service authentication failed. Please check your API key configuration.';
          logMessage = `${apiError.provider?.toUpperCase() || 'AI'} API key is invalid or expired`;
          AI_STATUS.available = false;
          AI_STATUS.error = 'Authentication failed';
          break;
        case 429:
          if (apiError.error?.type === 'insufficient_quota') {
            userMessage = `💳 ${apiError.provider?.toUpperCase() || 'AI'} service quota exceeded. Please check your billing.`;
            logMessage = `${apiError.provider?.toUpperCase() || 'AI'} quota/billing limit exceeded`;
          } else {
            userMessage = '⏳ AI service is busy. Please wait a moment and try again.';
            logMessage = `${apiError.provider?.toUpperCase() || 'AI'} rate limit exceeded`;
          }
          break;
        case 400:
          if (apiError.error?.code === 'context_length_exceeded') {
            userMessage = '📏 Question too long for AI analysis. Please shorten your question.';
            logMessage = `${apiError.provider?.toUpperCase() || 'AI'} context length exceeded`;
          } else {
            userMessage = '❌ Invalid request format. Please try again.';
            logMessage = `${apiError.provider?.toUpperCase() || 'AI'} bad request`;
          }
          break;
        case 500:
        case 502:
        case 503:
          userMessage = `🔧 ${apiError.provider?.toUpperCase() || 'AI'} service is temporarily unavailable. Please try again in a few minutes.`;
          logMessage = `${apiError.provider?.toUpperCase() || 'AI'} server error`;
          break;
        default:
          userMessage = '🤖 AI assessment is temporarily unavailable. Please try again later.';
          logMessage = `${apiError.provider?.toUpperCase() || 'AI'} unknown error`;
      }

      console.error(logMessage);

      // Fallback to descriptive assessment
      const fallbackAssessment = `${userMessage}\n\nBasic comparison: Your answer "${userAnswerArray.join(', ') || 'None'}" vs correct answer "${correctAnswerArray.join(', ')}".`;
      
      responseData.assessment = fallbackAssessment;
      responseData.aiUsed = false;
      responseData.error = userMessage;
      userData.responses.push(responseData);
      await saveUserData();

      res.json({ 
        assessment: fallbackAssessment,
        error: userMessage,
        error_type: apiError.error?.type,
        sessionId: responseData.sessionId
      });
    }

  } catch (error) {
    console.error('❌ Assessment endpoint error:', error);
    res.status(500).json({ 
      error: 'Assessment service temporarily unavailable',
      message: 'Please try again later'
    });
  }
});

// Multi-CSV Upload Endpoint
app.post('/api/upload-csvs', uploadRateLimiter, uploadAuthGuard, upload.array('files', 5), async (req, res) => {
  console.log('📁 Multi-CSV upload request (orchestrated) received');
  const startedAt = Date.now();
  const requestId = req.requestId;
  const actor = req.actor;

  try {
    const files = req.files || [];
    enforceTotalSize(files, UPLOAD_MAX_TOTAL_BYTES);
    const options = JSON.parse(req.body.options || '{}');

    if (REQUEST_LOG_ENABLED) {
      const totalBytes = files.reduce((sum, f) => sum + (f?.size || 0), 0);
      logEvent('upload_received', { requestId, files: files.length, totalBytes, ...actor });
    }

    if (req.body.uploadId) options.uploadId = options.uploadId || req.body.uploadId;

    // support top-level fallback fields
    if (req.body.preset) options.preset = options.preset || req.body.preset;
    if (req.body.headersMap) {
      try { options.headersMap = options.headersMap || JSON.parse(req.body.headersMap); } catch (e) { /* ignore */ }
    }

    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });
    if (!integratedManager) {
      return res.status(500).json({ error: 'IntegratedQuestionManager not initialized on server' });
    }

    const uploadId = options.uploadId || `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const existingRecord = idempotencyService?.get(uploadId);

    if (existingRecord && existingRecord.status === 'completed') {
      await cleanupUploadedFiles(files);
      const cached = { ...(existingRecord.response || {}), uploadId, idempotent: true };
      await idempotencyService?.recordReuse({ uploadId, response: cached, actor });
      recordUploadReuse({ requestId, uploadId, idempotent: true, ...actor });
      return res.json(cached);
    }

    await idempotencyService?.recordStart({
      uploadId,
      options,
      files: files.map(f => ({ name: f.originalname, size: f.size })),
      actor
    });

    const detailsPerFile = [];
    const summary = { processed: 0, added: 0, updated: 0, skipped: 0, errors: [] };

    for (const file of files) {
      const csvContent = await fs.readFile(file.path, 'utf8');
      enforceRowLimit(csvContent, UPLOAD_ROW_LIMIT);
      try {
        const result = await integratedManager.importFromCSV(csvContent, {
          mergeStrategy: options.mergeStrategy || 'skip',
          strictValidation: options.strictness === 'strict',
          autoCorrect: options.autoCorrect !== false,
          preserveCustomFields: true,
          snapshotRowLimit: options.snapshotRowLimit || 50,
          preset: options.preset || null,
          headersMap: options.headersMap || null,
          uploadId
        });

        const fileDetail = {
          filename: file.originalname,
          size: file.size,
          processed: result.summary?.processed ?? result.parseStats?.total ?? 0,
          added: result.summary?.added ?? 0,
          updated: result.summary?.updated ?? 0,
          skipped: result.summary?.skipped ?? 0,
          errors: (result.summary?.errors || []).map(e => e.error || e),
          hash: hashContent(csvContent)
        };

        detailsPerFile.push(fileDetail);
        summary.processed += fileDetail.processed;
        summary.added += fileDetail.added;
        summary.updated += fileDetail.updated;
        summary.skipped += fileDetail.skipped;
        summary.errors.push(...fileDetail.errors);
      } finally {
        try { await fs.unlink(file.path); } catch (e) { /* best-effort cleanup */ }
      }
    }

    // sync global questionBank with integrated manager state for downstream endpoints
    questionBank.questions = integratedManager.getAllQuestions();
    questionBank.metadata = integratedManager.metadata || {};
    if (!questionBank.uploads) questionBank.uploads = [];
    questionBank.uploads.push({ uploadId, timestamp: new Date().toISOString(), filesCount: files.length, options, summary });
    await saveQuestionBank();

    const responsePayload = {
      uploadId,
      summary,
      detailsPerFile,
      questionBankStats: {
        totalQuestions: questionBank.questions.length,
        totalUploads: questionBank.uploads.length
      },
      idempotent: false
    };

    await idempotencyService?.recordSuccess({
      uploadId,
      response: responsePayload,
      options,
      files: detailsPerFile,
      actor
    });

    recordUploadSuccess({
      requestId,
      uploadId,
      durationMs: Date.now() - startedAt,
      processed: summary.processed,
      added: summary.added,
      errors: summary.errors.length,
      idempotent: false,
      ...actor
    });

    res.json(responsePayload);

  } catch (error) {
    console.error('❌ Upload orchestration failed:', error);
    recordUploadFailure({ requestId, error: error?.message || String(error), ...actor });
    // cleanup
    if (req.files) {
      await cleanupUploadedFiles(req.files);
    }
    if (idempotencyService && req?.body) {
      let parsedOptions = {};
      try { parsedOptions = JSON.parse(req.body.options || '{}'); } catch (e) { parsedOptions = {}; }
      const uploadId = req.body.uploadId || parsedOptions.uploadId || 'unknown';
      await idempotencyService.recordFailure({ uploadId, error, actor });
    }
    res.status(500).json({ error: 'Upload processing failed', message: error.message });
  }
});

// Get question bank statistics
app.get('/api/question-bank/stats', async (req, res) => {
  try {
    const stats = {
      totalQuestions: questionBank.questions.length,
      totalUploads: questionBank.uploads.length,
      categories: [...new Set(questionBank.questions.map(q => q.category))],
      difficulties: [...new Set(questionBank.questions.map(q => q.difficulty))],
      lastUpdated: questionBank.metadata.lastUpdated,
      version: questionBank.metadata.version
    };
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Question bank stats error:', error);
    res.status(500).json({ error: 'Failed to get question bank statistics' });
  }
});

// Get questions from question bank
app.get('/api/question-bank/questions', async (req, res) => {
  try {
    const { 
      category, 
      difficulty, 
      limit = 50, 
      offset = 0,
      search 
    } = req.query;
    
    let filteredQuestions = [...questionBank.questions];
    
    // Apply filters
    if (category && category !== 'all') {
      filteredQuestions = filteredQuestions.filter(q => q.category === category);
    }
    
    if (difficulty && difficulty !== 'all') {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty === difficulty);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredQuestions = filteredQuestions.filter(q => 
        q.question.toLowerCase().includes(searchLower) ||
        q.explanation.toLowerCase().includes(searchLower)
      );
    }
    
    // Pagination
    const total = filteredQuestions.length;
    const paginatedQuestions = filteredQuestions.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      questions: paginatedQuestions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('❌ Question bank query error:', error);
    res.status(500).json({ error: 'Failed to query question bank' });
  }
});

// Export question bank
app.get('/api/question-bank/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'id,category,difficulty,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,points,time_limit';
      const csvRows = questionBank.questions.map(q => {
        const values = [
          q.id,
          q.category,
          q.difficulty,
          q.type,
          `"${q.question.replace(/"/g, '""')}"`,
          `"${q.option_a?.replace(/"/g, '""') || ''}"`,
          `"${q.option_b?.replace(/"/g, '""') || ''}"`,
          `"${q.option_c?.replace(/"/g, '""') || ''}"`,
          `"${q.option_d?.replace(/"/g, '""') || ''}"`,
          q.correct_answer,
          `"${q.explanation?.replace(/"/g, '""') || ''}"`,
          q.points,
          q.time_limit
        ];
        return values.join(',');
      });
      
      const csv = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=question_bank.csv');
      res.send(csv);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=question_bank.json');
      res.json(questionBank);
    }
    
  } catch (error) {
    console.error('❌ Question bank export error:', error);
    res.status(500).json({ error: 'Failed to export question bank' });
  }
});

// Migration endpoint - import existing questions.csv
app.post('/api/migrate-existing-questions', async (req, res) => {
  try {
    const questionsCSVPath = path.join(__dirname, 'src', 'data', 'questions.csv');
    
    try {
      const csvContent = await fs.readFile(questionsCSVPath, 'utf8');
      const { headers, rows } = parseCSVContent(csvContent);
      
      console.log(`📦 Migrating ${rows.length} questions from existing CSV`);
      
      // Create backup first
      await createBackup();
      
      const migrationId = crypto.randomUUID();
      let migrated = 0;
      
      for (const [index, row] of rows.entries()) {
        const question = convertToQuestionFormat(
          row, 
          migrationId, 
          index, 
          'questions.csv (migration)'
        );
        
        // Auto-generate ID if missing
        if (!question.id) {
          const maxId = Math.max(0, ...questionBank.questions.map(q => q.id || 0));
          question.id = maxId + 1;
        }
        
        // Check for duplicates - skip if exists
        const duplicate = findDuplicate(question, questionBank.questions);
        if (!duplicate) {
          questionBank.questions.push(question);
          migrated++;
        }
      }
      
      // Record migration
      questionBank.uploads.push({
        uploadId: migrationId,
        timestamp: new Date().toISOString(),
        userId: 'system',
        filesCount: 1,
        options: { mergeStrategy: 'skip', type: 'migration' },
        summary: { processed: rows.length, added: migrated, updated: 0, skipped: rows.length - migrated, errors: [] }
      });
      
      await saveQuestionBank();
      
      res.json({
        success: true,
        message: `Migration complete: ${migrated} questions added`,
        summary: {
          processed: rows.length,
          added: migrated,
          skipped: rows.length - migrated
        }
      });
      
    } catch (fileError) {
      res.status(404).json({
        error: 'questions.csv not found',
        message: 'No existing questions.csv file to migrate'
      });
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
});

// User session management
app.post('/api/user-session', async (req, res) => {
  try {
    const { action, userId, sessionData } = req.body;
    
    if (action === 'start') {
      const sessionId = crypto.randomUUID();
      const session = {
        sessionId,
        userId: userId || `user_${Date.now()}`,
        startTime: new Date().toISOString(),
        ...sessionData
      };
      
      userData.sessions.push(session);
      await saveUserData();
      
      res.json({ sessionId, userId: session.userId });
    } else if (action === 'end') {
      const session = userData.sessions.find(s => s.sessionId === req.body.sessionId);
      if (session) {
        session.endTime = new Date().toISOString();
        session.duration = new Date(session.endTime) - new Date(session.startTime);
        await saveUserData();
      }
      res.json({ success: true });
    }
  } catch (error) {
    console.error('👤 User session error:', error);
    res.status(500).json({ error: 'Session management failed' });
  }
});

// CRM export endpoint
app.get('/api/export-data', async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    
    let filteredData = { ...userData };
    
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      
      filteredData.responses = userData.responses.filter(r => {
        const responseDate = new Date(r.timestamp);
        return responseDate >= start && responseDate <= end;
      });
      
      filteredData.sessions = userData.sessions.filter(s => {
        const sessionDate = new Date(s.startTime);
        return sessionDate >= start && sessionDate <= end;
      });
    }
    
    if (format === 'csv') {
      // Convert to CSV format for CRM import
      const csvData = filteredData.responses.map(r => ({
        Date: r.timestamp,
        UserId: r.userId,
        SessionId: r.sessionId,
        Question: r.questionText,
        UserAnswer: r.userAnswer,
        CorrectAnswer: r.correctAnswer,
        Assessment: r.assessment,
        AIUsed: r.aiUsed
      }));
      
      const csvHeader = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','));
      const csv = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=quiz_data.csv');
      res.send(csv);
    } else {
      res.json(filteredData);
    }
  } catch (error) {
    console.error('📊 Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// AI Question Supplementation endpoint
app.post('/api/supplement-questions', async (req, res) => {
  console.log('🤖 Question supplementation request received');
  
  try {
    const { prompt, missingCount, schema, provider = 'openai', options = {} } = req.body;

    // Validate request
    if (!prompt || !missingCount || missingCount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid request: prompt and missingCount are required',
        details: { prompt: !!prompt, missingCount }
      });
    }

    if (missingCount > 50) {
      return res.status(400).json({ 
        error: 'Cannot generate more than 50 questions per request',
        maxAllowed: 50,
        requested: missingCount
      });
    }

    // Check AI availability
    if (!AI_STATUS.available) {
      return res.status(503).json({ 
        error: 'AI service not available',
        details: 'Please configure an AI provider API key'
      });
    }

    // Generate questions using the appropriate AI provider
    console.log(`🎯 Generating ${missingCount} questions using ${provider}`);
    
    let aiResponse;
    const maxRetries = options.maxRetries || 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🔄 Generation attempt ${attempt}/${maxRetries}`);
        
        if (provider === 'openai') {
          aiResponse = await callOpenAI(prompt, null, null, AI_STATUS.apiKey);
        } else if (provider === 'gemini') {
          aiResponse = await callGemini(prompt, null, null, AI_STATUS.apiKey);
        } else {
          return res.status(400).json({ error: 'Unsupported AI provider', provider });
        }
        
        break; // Success - exit retry loop
        
      } catch (error) {
        console.error(`❌ Generation attempt ${attempt} failed:`, error.message);
        
        if (attempt >= maxRetries) {
          throw error; // Re-throw after max retries
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // Parse and validate the AI response
    const generatedQuestions = await parseAndValidateGeneratedQuestions(aiResponse, schema);
    
    // Return success response
    res.json({
      questions: generatedQuestions.valid,
      metadata: {
        requested: missingCount,
        generated: generatedQuestions.total,
        valid: generatedQuestions.valid.length,
        invalid: generatedQuestions.invalid.length,
        duplicates: generatedQuestions.duplicates || 0,
        provider: provider,
        attempts: attempt
      }
    });

    console.log(`✅ Successfully generated ${generatedQuestions.valid.length}/${missingCount} questions`);

  } catch (error) {
    console.error('❌ Question supplementation error:', error);
    
    // Handle specific AI provider errors
    if (error.status === 429) {
      res.status(429).json({ 
        error: 'AI service rate limit exceeded',
        retryAfter: 60,
        type: 'rate_limit'
      });
    } else if (error.status === 401) {
      res.status(401).json({ 
        error: 'AI service authentication failed',
        type: 'authentication'
      });
    } else if (error.status === 400) {
      res.status(422).json({ 
        error: 'Invalid request to AI service',
        details: error.message,
        type: 'invalid_request'
      });
    } else {
      res.status(500).json({ 
        error: 'Question generation failed',
        details: error.message,
        type: 'server_error'
      });
    }
  }
});

/**
 * Parse and validate AI-generated questions
 * @param {string} aiResponse - Raw AI response text
 * @param {Object} schema - Expected schema for validation
 * @returns {Object} Parsed and validated questions
 */
async function parseAndValidateGeneratedQuestions(aiResponse, schema) {
  const result = {
    total: 0,
    valid: [],
    invalid: [],
    duplicates: 0
  };

  try {
    // Extract CSV content from AI response
    let csvContent = aiResponse.trim();
    
    // Remove any markdown formatting or extra text
    const csvStart = csvContent.indexOf('Question,OptionA,OptionB,OptionC,OptionD,CorrectAnswer');
    if (csvStart >= 0) {
      csvContent = csvContent.substring(csvStart);
    }
    
    // Remove any text after the CSV data
    const lines = csvContent.split('\n');
    const csvLines = [];
    let inCsvData = false;
    
    for (const line of lines) {
      if (line.includes('Question,OptionA,OptionB,OptionC,OptionD,CorrectAnswer')) {
        inCsvData = true;
        csvLines.push(line);
      } else if (inCsvData && line.trim()) {
        // Check if this looks like a valid CSV row
        const parts = line.split(',');
        if (parts.length >= 6) {
          csvLines.push(line);
        } else {
          break; // End of CSV data
        }
      }
    }
    
    if (csvLines.length < 2) {
      throw new Error('No valid CSV data found in AI response');
    }
    
    // Parse CSV data
    const csvText = csvLines.join('\n');
    const questions = parseCSVContent(csvText);
    
    result.total = questions.length;
    
    // Validate each question
    const requiredFields = ['Question', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectAnswer'];
    const validAnswers = ['A', 'B', 'C', 'D'];
    
    questions.forEach((question, index) => {
      const errors = [];
      
      // Check required fields
      requiredFields.forEach(field => {
        if (!question[field] || question[field].toString().trim() === '') {
          errors.push(`Missing or empty ${field}`);
        }
      });
      
      // Validate correct answer
      if (question.CorrectAnswer && !validAnswers.includes(question.CorrectAnswer.toString().toUpperCase())) {
        errors.push('CorrectAnswer must be A, B, C, or D');
      }
      
      // Check for reasonable question length
      if (question.Question && question.Question.toString().length < 10) {
        errors.push('Question too short');
      }
      
      if (errors.length === 0) {
        // Add unique ID and timestamp
        question.id = `supp_${Date.now()}_${index}`;
        question.generated = true;
        question.generatedAt = new Date().toISOString();
        
        result.valid.push(question);
      } else {
        result.invalid.push({
          question,
          errors,
          index
        });
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Question parsing error:', error);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

// Enhanced diagnostics endpoint (combining both /diag and /api/diagnostics)
app.get('/diag', (req, res) => {
  res.json({ 
    status: 'ok', 
    aiStatus: AI_STATUS,
    userDataStats: {
      totalUsers: userData.users.length,
      totalSessions: userData.sessions.length,
      totalResponses: userData.responses.length
    },
    pid: process.pid, 
    now: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/api/diagnostics', (req, res) => {
  res.json({ 
    status: 'ok', 
    aiStatus: AI_STATUS,
    userDataStats: {
      totalUsers: userData.users.length,
      totalSessions: userData.sessions.length,
      totalResponses: userData.responses.length
    },
    pid: process.pid, 
    now: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Lightweight metrics snapshot (guarded by upload API key)
app.get('/ops/metrics', uploadAuthGuard, (req, res) => {
  res.json({
    metrics: getMetricsSnapshot(),
    uptimeMs: Math.round(process.uptime() * 1000)
  });
});

// Initialize server
async function startServer() {
  await loadUserData();
  await loadQuestionBank();
  await ensureUploadsDir();

  const retentionMs = Math.max(0, TEMP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  if (retentionMs && TEMP_CLEAN_INTERVAL_MS > 0) {
    cleanupStaleUploads(retentionMs).catch(() => {});
    const timer = setInterval(() => cleanupStaleUploads(retentionMs), TEMP_CLEAN_INTERVAL_MS);
    timer.unref?.();
    if (REQUEST_LOG_ENABLED) {
      logEvent('uploads_cleanup_scheduled', { retentionMs, intervalMs: TEMP_CLEAN_INTERVAL_MS });
    }
  }

  try {
    idempotencyService = new UploadIdempotencyService(UPLOADS_DIR, {
      maxAuditBytes: AUDIT_MAX_BYTES,
      maxRecords: IDEMPOTENCY_MAX_RECORDS
    });
    await idempotencyService.init();
    console.log('🧊 Idempotency service initialized');
  } catch (e) {
    console.warn('⚠️ Failed to initialize idempotency service:', e?.message || e);
    idempotencyService = null;
  }
  // Initialize IntegratedQuestionManager for server-side operations (dynamic import for ESM module)
  try {
    const mod = await import('./src/services/IntegratedQuestionManager.js');
    const IntegratedQuestionManager = mod.default || mod.IntegratedQuestionManager;
    integratedManager = new IntegratedQuestionManager();
    await integratedManager.initialize(questionBank);
    // keep questionBank in sync with manager state
    questionBank.questions = integratedManager.getAllQuestions();
    questionBank.metadata = integratedManager.metadata || {};
    console.log('🧩 IntegratedQuestionManager initialized');
  } catch (e) {
    console.warn('⚠️ Failed to initialize IntegratedQuestionManager:', e?.message || e);
    integratedManager = null;
  }
  
  const port = process.env.PORT || 5500;
  app.listen(port, '127.0.0.1', () => {
    console.log('🚀 Enhanced Quiz Server Started');
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🤖 AI: ${AI_STATUS.available ? '✅ Available' : '❌ Configure provider and API key'}`);
    console.log(`💾 User Data: ${userData.responses.length} responses stored`);
    console.log(`📚 Question Bank: ${questionBank.questions.length} questions`);
    console.log(`🔧 Version: 2.0.0`);
  });
}

// Endpoint to download the last parse report generated by the IntegratedQuestionManager
app.get('/api/parse-report/download', reportRateLimiter, reportAuthGuard, async (req, res) => {
  const requestId = req.requestId;
  const startedAt = Date.now();
  const actor = req.actor;
  try {
    if (!integratedManager) {
      return res.status(500).json({ error: 'IntegratedQuestionManager not initialized on server' });
    }

    // Optionally accept filename override
    const filename = req.query.filename;
    const exportResult = await integratedManager.exportLastParseReport({ filename });

    if (REQUEST_LOG_ENABLED) {
      logEvent('parse_report_request', { requestId, filename: exportResult?.filename || 'latest', ...actor });
    }

    if (!exportResult) {
      return res.status(404).json({ error: 'No parse report available' });
    }

    if (exportResult.type === 'server') {
      // Stream the file to the response to minimize memory usage
      const filePath = exportResult.path;
      const stat = await fs.stat(filePath);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
      res.setHeader('Content-Length', stat.size);

      const readStream = fsSync.createReadStream(filePath);
      readStream.on('error', (err) => {
        console.error('❌ Error streaming parse report:', err);
        if (!res.headersSent) res.status(500).end('Failed to stream file');
      });

      // When streaming finishes, delete temp file asynchronously
      readStream.on('end', async () => {
        try {
          await fs.unlink(filePath);
        } catch (unlinkErr) {
          console.warn('⚠️ Failed to delete temp parse report file:', unlinkErr.message || unlinkErr);
        }
      });

      // Pipe stream to response
      readStream.pipe(res);
      recordParseReportDownload({ requestId, durationMs: Date.now() - startedAt, streamed: true, ...actor });
      return;
    }

    if (exportResult.type === 'raw') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
      recordParseReportDownload({ requestId, durationMs: Date.now() - startedAt, streamed: false, ...actor });
      return res.send(exportResult.content);
    }

    // Browser blob case shouldn't occur on server, fallback to raw
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    recordParseReportDownload({ requestId, durationMs: Date.now() - startedAt, streamed: false, ...actor });
    return res.send(exportResult.content || '{}');

  } catch (error) {
    console.error('❌ Parse report download failed:', error);
    recordUploadFailure({ requestId, error: error?.message || String(error), scope: 'parse-report', ...actor });
    res.status(500).json({ error: 'Failed to export parse report', message: error.message });
  }
});

startServer().catch(console.error);
