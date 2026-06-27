const express = require('express');
const Groq = require('groq-sdk');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { getFinancialSnapshot } = require('../utils/buildCompactContext');

const router = express.Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// SYSTEM PROMPT --- /insights (JSON output)
// -----------------------------------------------------------------------------
const INSIGHTS_SYSTEM_PROMPT = `You are FinanceIQ, a personal financial advisor AI for South African users.
Analyse the user's financial data and respond ONLY with valid JSON --- no markdown, no backticks, no explanation:
{
  "highlights": [{"label": "string", "text": "string", "type": "ok|warn|danger|info"}],
  "tips": [{"title": "string", "body": "string", "type": "ok|warn|danger"}],
  "anomalies": [{"text": "string"}]
}
Use Rand (R) for all amounts. Be concise. Max 3 highlights, 3 tips, 2 anomalies.`;

// -----------------------------------------------------------------------------
// SYSTEM PROMPT --- /chat (conversational, NO JSON)
// -----------------------------------------------------------------------------
const CHAT_SYSTEM_PROMPT = `You are FinanceIQ, a friendly personal financial advisor AI for South African users.
Give concrete, personalised advice based on the user's financial data provided.
Use Rand (R) for all amounts. Be concise --- keep responses under 150 words unless asked for detail.
IMPORTANT: Reply in plain conversational text only. Never return JSON or code blocks.`;

// -----------------------------------------------------------------------------
// Fallback when no GROQ_API_KEY is configured
// -----------------------------------------------------------------------------
const MOCK_INSIGHTS = {
  highlights: [
    { label: 'AI Unavailable', text: 'Add a GROQ_API_KEY to your environment to enable AI insights.', type: 'info' }
  ],
  tips: [
    { title: 'Get started', body: 'Visit console.groq.com for a free API key --- no credit card needed.', type: 'info' }
  ],
  anomalies: []
};

// -----------------------------------------------------------------------------
// Helper: get Groq client
// -----------------------------------------------------------------------------
function getGroqClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// -----------------------------------------------------------------------------
// Helper: strip markdown fences
// -----------------------------------------------------------------------------
function stripMarkdownFences(raw) {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}



// -----------------------------------------------------------------------------
// POST /api/ai/insights
// -----------------------------------------------------------------------------
router.post('/insights', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) return res.json(MOCK_INSIGHTS);

    const snapshot = await getFinancialSnapshot(req.user.id);
    const compactContext = buildCompactContext(snapshot);

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
        { role: 'user', content: `Generate insights from this data:\n\n${compactContext}` }
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const cleaned = stripMarkdownFences(raw);

    try {
      return res.json(JSON.parse(cleaned));
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { return res.json(JSON.parse(match[0])); } catch { /* fall through */ }
      }
      return res.json({
        highlights: [{ label: 'Analysis', text: raw.substring(0, 200), type: 'info' }],
        tips: [], anomalies: [],
      });
    }
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/ai/chat
// -----------------------------------------------------------------------------
router.post('/chat', async (req, res) => {
  try {
    const { messages, financialContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A non-empty messages array is required.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.json({ role: 'assistant', content: MOCK_INSIGHTS.highlights[0].text });
    }

    const snapshot = financialContext && Object.keys(financialContext).length > 0
      ? financialContext
      : await getFinancialSnapshot(req.user.id);

    const compactContext = buildCompactContext(snapshot);

    const recentMessages = messages.slice(-6);

    const groqMessages = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: `My financial data:\n\n${compactContext}` },
      { role: 'assistant', content: 'Got it --- I have your financial summary and am ready to help.' },
      ...recentMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const groq = getGroqClient();
    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 400,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullText += text;
        if (fullText.length < 50 && (fullText.trim().startsWith('{') || fullText.trim().startsWith('['))) {
          res.write(`data: ${JSON.stringify({ text: "Let me help with that. Could you ask me something specific about your finances --- like how to reduce spending or whether you're on track with your goals?" })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('AI chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate AI response.' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Stream error occurred.' })}\n\n`);
    res.end();
  }
});

module.exports = router;
