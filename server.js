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
    const iv = Buffer.from(textParts.shift(), 'hex');
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

// Global OpenAI configuration (keeping server.js priority)
let OPENAI_KEY = process.env.OPENAI_API_KEY;
let USE_OPENAI = !!OPENAI_KEY;
let AI_STATUS = {
  available: false,
  lastChecked: null,
  error: null,
  checking: false
};

if (!USE_OPENAI) {
  console.warn('Warning: OPENAI_API_KEY not set. The server will start in MOCK mode and return a placeholder assessment for /api/assess. To enable real AI, set OPENAI_API_KEY in your .env.');
}

// Enhanced OpenAI validation function
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

// Serve static files (so you can open http://localhost:3000/User_Acceptance.html)
app.use(express.static(path.join(__dirname)));

// API key management endpoint
app.post('/api/configure-key', async (req, res) => {
  try {
    const { apiKey, action } = req.body;
    
    if (action === 'validate') {
      const validation = await validateOpenAIKey(apiKey);
      if (validation.valid) {
        OPENAI_KEY = apiKey;
        USE_OPENAI = true;
        AI_STATUS = {
          available: true,
          lastChecked: new Date().toISOString(),
          error: null,
          checking: false
        };
      }
      res.json({
        valid: validation.valid,
        error: validation.error,
        aiStatus: AI_STATUS
      });
    } else if (action === 'save') {
      // For production, encrypt and save to user session/database
      const encryptedKey = encryptApiKey(apiKey);
      console.log('🔐 API key encrypted and ready for storage');
      res.json({ success: true, message: 'API key secured' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('🔑 API key configuration error:', error);
    res.status(500).json({ error: 'Configuration failed' });
  }
});

// AI availability status endpoint
app.get('/api/ai-status', async (req, res) => {
  if (AI_STATUS.checking) {
    return res.json(AI_STATUS);
  }

  // Check if we need to revalidate (every 5 minutes)
  const shouldRecheck = !AI_STATUS.lastChecked || 
    (Date.now() - new Date(AI_STATUS.lastChecked).getTime()) > 5 * 60 * 1000;

  if (shouldRecheck && OPENAI_KEY) {
    AI_STATUS.checking = true;
    const validation = await validateOpenAIKey(OPENAI_KEY);
    AI_STATUS = {
      available: validation.valid,
      lastChecked: new Date().toISOString(),
      error: validation.error,
      checking: false
    };
  }

  res.json(AI_STATUS);
});

app.post('/api/assess', async (req, res) => {
  try {
    const { questionText, userAnswerArray = [], correctAnswerArray = [], userId, sessionId } = req.body || {};
    
    console.log('📝 Assessment request:', {
      useOpenAI: USE_OPENAI,
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
      aiUsed: USE_OPENAI
    };

    // If no API key is set, return mock assessment
    if (!USE_OPENAI || !OPENAI_KEY) {
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

    const systemPrompt = 'You are an expert tutor. Provide a concise (2-4 sentence) assessment in plain language explaining whether the user\'s answer is correct and why. If incorrect, briefly explain the correct reasoning.';
    const userPrompt = `Question: ${questionText}\nUser answer: ${userAnswerArray.join(', ') || 'None'}\nCorrect answer: ${correctAnswerArray.join(', ')}`;

    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 200,
      temperature: 0.2
    };

    console.log('🤖 Calling OpenAI API...');
    // Use global fetch (Node 18+). If your Node version doesn't have fetch, install node-fetch and use it instead.
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const body = await openaiRes.json();
    
    if (!openaiRes.ok) {
      // Enhanced error handling with user-friendly messages
      let userMessage;
      let logMessage = `OpenAI API Error ${openaiRes.status}: ${JSON.stringify(body)}`;
      
      switch (openaiRes.status) {
        case 401:
          userMessage = '🔑 AI service authentication failed. Please check your API key configuration.';
          logMessage = 'OpenAI API key is invalid or expired';
          AI_STATUS.available = false;
          AI_STATUS.error = 'Authentication failed';
          break;
        case 429:
          if (body.error?.type === 'insufficient_quota') {
            userMessage = '💳 AI service quota exceeded. Please check your OpenAI billing.';
            logMessage = 'OpenAI quota/billing limit exceeded';
          } else {
            userMessage = '⏳ AI service is busy. Please wait a moment and try again.';
            logMessage = 'OpenAI rate limit exceeded';
          }
          break;
        case 400:
          if (body.error?.code === 'context_length_exceeded') {
            userMessage = '📏 Question too long for AI analysis. Please shorten your question.';
            logMessage = 'OpenAI context length exceeded';
          } else {
            userMessage = '⚠️ AI service encountered an issue with the request format.';
            logMessage = `OpenAI bad request: ${body.error?.message || 'Unknown'}`;
          }
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          userMessage = '🔧 AI service temporarily down. Please try again in a moment.';
          logMessage = `OpenAI server error: ${openaiRes.status}`;
          break;
        default:
          userMessage = '❓ AI assessment temporarily unavailable. Please continue with the quiz.';
      }
      
      console.error(logMessage);
      responseData.assessment = userMessage;
      responseData.error = body.error?.type || 'api_error';
      
      userData.responses.push(responseData);
      await saveUserData();
      
      return res.status(200).json({ 
        assessment: userMessage,
        error_type: body.error?.type || 'unknown',
        recoverable: true,
        sessionId: responseData.sessionId
      });
    }

    const assessment = body?.choices?.[0]?.message?.content ?? '';
    console.log('✅ OpenAI assessment completed successfully');
    
    responseData.assessment = assessment;
    userData.responses.push(responseData);
    await saveUserData();
    
    res.json({ 
      assessment,
      sessionId: responseData.sessionId
    });
    
  } catch (err) {
    console.error('💥 Assessment proxy error:', err);
    const userMessage = '🔌 AI assessment service unavailable. Please check your connection.';
    
    const responseData = {
      timestamp: new Date().toISOString(),
      userId: req.body?.userId || 'anonymous',
      sessionId: req.body?.sessionId || crypto.randomUUID(),
      questionText: (req.body?.questionText || '').slice(0, 200),
      userAnswer: (req.body?.userAnswerArray || []).join(', '),
      correctAnswer: (req.body?.correctAnswerArray || []).join(', '),
      assessment: userMessage,
      error: 'network_error',
      aiUsed: false
    };
    
    userData.responses.push(responseData);
    await saveUserData();
    
    res.status(200).json({ 
      assessment: userMessage,
      error_type: 'network_error',
      recoverable: true,
      sessionId: responseData.sessionId
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
    useOpenAI: USE_OPENAI,
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
    useOpenAI: USE_OPENAI,
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
    console.log(`🤖 OpenAI: ${USE_OPENAI ? '✅ Enabled' : '❌ Disabled (configure API key)'}`);
    console.log(`💾 User Data: ${userData.responses.length} responses stored`);
    console.log(`🔧 Version: 2.0.0`);
  });
}

startServer().catch(console.error);
