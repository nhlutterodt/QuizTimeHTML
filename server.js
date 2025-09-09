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
  
  const port = process.env.PORT || 5500;
  app.listen(port, '127.0.0.1', () => {
    console.log('🚀 Enhanced Quiz Server Started');
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🤖 AI: ${AI_STATUS.available ? '✅ Available' : '❌ Configure provider and API key'}`);
    console.log(`💾 User Data: ${userData.responses.length} responses stored`);
    console.log(`🔧 Version: 2.0.0`);
  });
}

startServer().catch(console.error);
