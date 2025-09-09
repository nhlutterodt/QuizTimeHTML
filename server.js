// Enhanced Express server with comprehensive OpenAI integration and user management
// Combined features from both server.js and server-enhanced.js
// Usage:
// 1. Copy this repository to a folder with your quiz HTML.
// 2. Create a .env file with: OPENAI_API_KEY=sk-...
// 3. npm install
// 4. npm start

const express = require('express');
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const multer = require('multer');

const app = express();

// CORS configuration for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '10mb' }));

// Initialize user data storage
const USER_DATA_FILE = path.join(__dirname, 'user_data.json');
let userData = { users: [], sessions: [], responses: [] };

// Load existing user data
async function loadUserData() {
  try {
    const data = await fs.readFile(USER_DATA_FILE, 'utf8');
    userData = JSON.parse(data);
    console.log('✅ User data loaded successfully');
  } catch (error) {
    console.log('📝 Creating new user data file - file not found:', error.message);
    await saveUserData();
  }
}

// Save user data
async function saveUserData() {
  try {
    await fs.writeFile(USER_DATA_FILE, JSON.stringify(userData, null, 2));
    console.log('💾 User data saved successfully');
  } catch (error) {
    console.error('❌ Failed to save user data:', error);
  }
}

// Question Bank Management
const QUESTION_BANK_FILE = path.join(__dirname, 'data', 'question_bank.json');
const BACKUPS_DIR = path.join(__dirname, 'data', 'backups');
let questionBank = { questions: [], uploads: [], metadata: {} };

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB total
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed!'), false);
    }
  }
});

// Load question bank
async function loadQuestionBank() {
  try {
    const data = await fs.readFile(QUESTION_BANK_FILE, 'utf8');
    questionBank = JSON.parse(data);
    console.log(`✅ Question bank loaded: ${questionBank.questions.length} questions`);
  } catch (error) {
    console.log('📝 Creating new question bank - file not found:', error.message);
    await saveQuestionBank();
  }
}

// Save question bank
async function saveQuestionBank() {
  try {
    questionBank.metadata.lastUpdated = new Date().toISOString();
    questionBank.metadata.totalQuestions = questionBank.questions.length;
    
    await fs.writeFile(QUESTION_BANK_FILE, JSON.stringify(questionBank, null, 2));
    console.log(`💾 Question bank saved: ${questionBank.questions.length} questions`);
  } catch (error) {
    console.error('❌ Failed to save question bank:', error);
    throw error;
  }
}

// Create backup before destructive operations
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `question_bank_${timestamp}.json`);
    
    await fs.writeFile(backupFile, JSON.stringify(questionBank, null, 2));
    console.log(`📦 Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    throw error;
  }
}

// Parse CSV content
function parseCSVContent(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    throw new Error('Empty CSV file');
  }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === headers.length) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      rows.push(obj);
    }
  }
  
  return { headers, rows };
}

// Parse individual CSV line handling quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

// Convert CSV row to question format
function convertToQuestionFormat(csvRow, uploadId, rowIndex, filename) {
  const question = {
    id: csvRow.id ? parseInt(csvRow.id) : null,
    category: csvRow.category || 'General',
    difficulty: csvRow.difficulty || 'Medium',
    type: csvRow.type || 'multiple_choice',
    question: csvRow.question,
    option_a: csvRow.option_a,
    option_b: csvRow.option_b,
    option_c: csvRow.option_c,
    option_d: csvRow.option_d,
    correct_answer: csvRow.correct_answer,
    explanation: csvRow.explanation || '',
    points: parseInt(csvRow.points) || 1,
    time_limit: parseInt(csvRow.time_limit) || 30,
    
    // Provenance metadata
    source: {
      uploadId,
      filename,
      rowIndex,
      originalId: csvRow.id,
      uploadedAt: new Date().toISOString()
    }
  };
  
  return question;
}

// Check for duplicate questions
function findDuplicate(newQuestion, existingQuestions) {
  // Check by ID first
  if (newQuestion.id) {
    const idMatch = existingQuestions.find(q => q.id === newQuestion.id);
    if (idMatch) return { type: 'id', question: idMatch };
  }
  
  // Check by question text (normalized)
  const normalizedNew = newQuestion.question.toLowerCase().trim();
  const textMatch = existingQuestions.find(q => 
    q.question.toLowerCase().trim() === normalizedNew
  );
  if (textMatch) return { type: 'text', question: textMatch };
  
  return null;
}

// Apply merge strategy
function applyMergeStrategy(newQuestion, existingQuestion, strategy) {
  switch (strategy) {
    case 'skip':
      return null; // Skip the new question
      
    case 'overwrite':
      // Keep metadata from existing but update content
      return {
        ...newQuestion,
        source: existingQuestion.source // Keep original source
      };
      
    case 'force':
      // Create new question with new ID
      const maxId = Math.max(0, ...questionBank.questions.map(q => q.id || 0));
      return {
        ...newQuestion,
        id: maxId + 1
      };
      
    case 'merge':
      // Merge non-empty fields
      return {
        ...existingQuestion,
        ...Object.fromEntries(
          Object.entries(newQuestion).filter(([key, value]) => 
            value !== '' && value != null && key !== 'source'
          )
        ),
        source: existingQuestion.source // Keep original source
      };
      
    default:
      return null;
  }
}

// Encryption utilities for secure API key storage
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encryptApiKey(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptApiKey(text) {
  try {
    const textParts = text.split(':');
    textParts.shift(); // Remove IV (not used in legacy crypto)
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('🔓 Decryption failed:', error);
    return null;
  }
}

// Global AI configuration (supporting multiple providers)
let OPENAI_KEY = process.env.OPENAI_API_KEY;
let GEMINI_KEY = process.env.GEMINI_API_KEY;
let CURRENT_PROVIDER = null;
let CURRENT_API_KEY = null;
let USE_AI = false;
let AI_STATUS = {
  available: false,
  lastChecked: null,
  error: null,
  checking: false,
  provider: null
};

// Initialize based on environment variables
if (OPENAI_KEY) {
  CURRENT_PROVIDER = 'openai';
  CURRENT_API_KEY = OPENAI_KEY;
  USE_AI = true;
} else if (GEMINI_KEY) {
  CURRENT_PROVIDER = 'gemini';
  CURRENT_API_KEY = GEMINI_KEY;
  USE_AI = true;
}

if (!USE_AI) {
  console.warn('Warning: No AI API keys set. The server will start in MOCK mode and return placeholder assessments. To enable real AI, set OPENAI_API_KEY or GEMINI_API_KEY in your .env.');
}

// Enhanced API validation functions for multiple providers
async function validateOpenAIKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  
  try {
    console.log('🔍 Validating OpenAI API key...');
    const testPayload = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test' }],
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
      const errorData = await response.json();
      console.log('❌ OpenAI API key validation failed:', response.status, errorData);
      return { 
        valid: false, 
        error: `API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}` 
      };
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
app.post('/api/upload-csvs', upload.array('files', 5), async (req, res) => {
  console.log('📁 Multi-CSV upload request received');
  
  try {
    const files = req.files;
    const options = JSON.parse(req.body.options || '{}');
    const uploadId = crypto.randomUUID();
    
    console.log(`📊 Processing ${files.length} files with options:`, options);
    
    // Validate files
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Initialize upload tracking
    const uploadSummary = {
      processed: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    
    const detailsPerFile = [];
    const { mergeStrategy = 'skip', strictness = 'lenient' } = options;
    
    // Create backup before making changes
    if (mergeStrategy === 'overwrite') {
      await createBackup();
    }
    
    // Process each file
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      const fileDetail = {
        filename: file.originalname,
        size: file.size,
        processed: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };
      
      try {
        console.log(`📄 Processing file: ${file.originalname}`);
        
        // Read file content
        const csvContent = await fs.readFile(file.path, 'utf8');
        const { headers, rows } = parseCSVContent(csvContent);
        
        console.log(`📋 Parsed ${rows.length} rows from ${file.originalname}`);
        
        // Validate required headers
        const requiredHeaders = ['question'];
        const missingHeaders = requiredHeaders.filter(h => 
          !headers.some(header => header.toLowerCase().includes(h.toLowerCase()))
        );
        
        if (missingHeaders.length > 0) {
          const error = `Missing required headers: ${missingHeaders.join(', ')}`;
          fileDetail.errors.push(error);
          uploadSummary.errors.push(`${file.originalname}: ${error}`);
          
          if (strictness === 'strict') {
            detailsPerFile.push(fileDetail);
            continue; // Skip this file in strict mode
          }
        }
        
        // Process each row
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          fileDetail.processed++;
          uploadSummary.processed++;
          
          try {
            // Convert to question format
            const newQuestion = convertToQuestionFormat(
              row, 
              uploadId, 
              rowIndex, 
              file.originalname
            );
            
            // Validate question
            if (!newQuestion.question || newQuestion.question.trim() === '') {
              throw new Error('Empty question text');
            }
            
            // Auto-generate ID if missing
            if (!newQuestion.id) {
              const maxId = Math.max(0, ...questionBank.questions.map(q => q.id || 0));
              newQuestion.id = maxId + 1;
            }
            
            // Check for duplicates
            const duplicate = findDuplicate(newQuestion, questionBank.questions);
            
            if (duplicate) {
              const result = applyMergeStrategy(newQuestion, duplicate.question, mergeStrategy);
              
              if (result === null) {
                // Skipped
                fileDetail.skipped++;
                uploadSummary.skipped++;
              } else if (mergeStrategy === 'force') {
                // Add as new
                questionBank.questions.push(result);
                fileDetail.added++;
                uploadSummary.added++;
              } else {
                // Update existing
                const existingIndex = questionBank.questions.findIndex(q => q.id === duplicate.question.id);
                questionBank.questions[existingIndex] = result;
                fileDetail.updated++;
                uploadSummary.updated++;
              }
            } else {
              // Add new question
              questionBank.questions.push(newQuestion);
              fileDetail.added++;
              uploadSummary.added++;
            }
            
          } catch (rowError) {
            const error = `Row ${rowIndex + 1}: ${rowError.message}`;
            fileDetail.errors.push(error);
            uploadSummary.errors.push(`${file.originalname} - ${error}`);
            
            if (strictness === 'strict') {
              throw new Error(`Strict mode: ${error}`);
            }
          }
        }
        
      } catch (fileError) {
        console.error(`❌ Error processing ${file.originalname}:`, fileError);
        fileDetail.errors.push(fileError.message);
        uploadSummary.errors.push(`${file.originalname}: ${fileError.message}`);
      } finally {
        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.warn('Warning: Failed to clean up uploaded file:', unlinkError);
        }
      }
      
      detailsPerFile.push(fileDetail);
    }
    
    // Record upload metadata
    const uploadRecord = {
      uploadId,
      timestamp: new Date().toISOString(),
      userId: options.owner || 'anonymous',
      filesCount: files.length,
      options,
      summary: uploadSummary,
      detailsPerFile
    };
    
    questionBank.uploads.push(uploadRecord);
    
    // Save question bank
    await saveQuestionBank();
    
    console.log(`✅ Upload complete: ${uploadSummary.added} added, ${uploadSummary.updated} updated, ${uploadSummary.skipped} skipped`);
    
    res.json({
      uploadId,
      summary: uploadSummary,
      detailsPerFile,
      questionBankStats: {
        totalQuestions: questionBank.questions.length,
        totalUploads: questionBank.uploads.length
      }
    });
    
  } catch (error) {
    console.error('❌ Upload endpoint error:', error);
    
    // Clean up any uploaded files
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.warn('Warning: Failed to clean up file:', unlinkError);
        }
      }
    }
    
    res.status(500).json({
      error: 'Upload processing failed',
      message: error.message
    });
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

// Initialize server
async function startServer() {
  await loadUserData();
  await loadQuestionBank();
  
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

startServer().catch(console.error);
