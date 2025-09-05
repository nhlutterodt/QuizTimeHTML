// Simple Express proxy for OpenAI Chat Completions
// Usage:
// 1. Copy this repository to a folder with your quiz HTML.
// 2. Create a .env file with: OPENAI_API_KEY=sk-...
// 3. npm install
// 4. npm start

const express = require('express');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY in environment. Create a .env with OPENAI_API_KEY=your_key');
  process.exit(1);
}

// Serve static files (so you can open http://localhost:3000/User_Acceptance.html)
app.use(express.static(path.join(__dirname)));

app.post('/api/assess', async (req, res) => {
  try {
    const { questionText, userAnswerArray = [], correctAnswerArray = [] } = req.body || {};
    if (!questionText) return res.status(400).json({ error: 'Missing questionText' });

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
      // Forward OpenAI error payload and status
      return res.status(openaiRes.status).json(body);
    }

    const assessment = body?.choices?.[0]?.message?.content ?? '';
    res.json({ assessment });
  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).json({ error: 'proxy_error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Proxy + static server running: http://localhost:${port}`));
