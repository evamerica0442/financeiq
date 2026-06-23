const express = require('express');
const Groq = require('groq-sdk');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { getNetworthInsights, getNetworthHistory } = require('../services/networthService');

const router = express.Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — for /insights (JSON output)
// -----------------------------------------------------------------------------
const INSIGHTS_SYSTEM_PROMPT = `You are FinanceIQ, a personal financial advisor AI. You have access to the user's full financial data including their transactions, budgets, goals, assets, and liabilities.

Always reference specific numbers from their data. Be concise. Use South African Rand (R) as the currency unless the user's profile says otherwise.

Respond ONLY with valid JSON in this exact format and nothing else — no markdown, no backticks, no explanation:
{
  "highlights": [{"label": "string", "text": "string", "type": "ok|warn|danger|info"}],
  "tips": [{"title": "string", "body": "string", "type": "ok|warn|danger"}],
  "anomalies": [{"text": "string"}]
}`;

// -----------------------------------------------------------------------------
// CHAT SYSTEM PROMPT — for /chat (conversational output, NO JSON)
// -----------------------------------------------------------------------------
const CHAT_SYSTEM_PROMPT = `You are FinanceIQ, a friendly and knowledgeable personal financial advisor AI. You have access to the user's full financial data including their transactions, budgets, goals, assets, and liabilities.

Your job is to:
1. Detect patterns and anomalies in spending
2. Give concrete, actionable tips (not generic advice)
3. Project goal completion dates and suggest adjustments
4. Flag budget categories approaching or exceeding their limits
5. Highlight wins and positive trends
6. Answer questions about their finances in a friendly, clear way

Always reference specific numbers from their data. Be concise and conversational.
Use South African Rand (R) as the currency unless the user's profile says otherwise.

IMPORTANT: Respond in plain conversational text only. Do NOT return JSON, code blocks, or any structured data format. Write as if you are a human financial advisor having a chat.`;

// -----------------------------------------------------------------------------
// Fallback when no GROQ_API_KEY is configured
// -----------------------------------------------------------------------------
const MOCK_INSIGHTS = {
  highlights: [
    { label: 'AI Insights Unavailable', text: 'Add a GROQ_API_KEY to your environment to enable AI-powered insights.', type: 'info' },
  ],
  tips: [
    { title: 'Get started', body: 'Visit console.groq.com to get a free Groq API key — no credit card required.', type: 'info' }
  ],
  anomalies: []
};

// -----------------------------------------------------------------------------
// Helper: fetch user's complete financial snapshot from the database
// -----------------------------------------------------------------------------
async function getFinancialSnapshot(userId) {
  const [transactions, budgets, goals, assets, networthInsights, networthHistory] = await Promise.all([
    pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 100', [userId]),
    pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM assets WHERE user_id = $1', [userId]),
    getNetworthInsights(userId),
    getNetworthHistory(userId, 6),
  ]);
  return {
    transactions: transactions.rows,
    budgets: budgets.rows,
    goals: goals.rows,
    assets: assets.rows,
    networthInsights,
    networthHistory,
  };
}

// -----------------------------------------------------------------------------
// Helper: get Groq client instance
// -----------------------------------------------------------------------------
function getGroqClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// -----------------------------------------------------------------------------
// Helper: strip markdown code fences from raw model response
// -----------------------------------------------------------------------------
function stripMarkdownFences(raw) {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

// -----------------------------------------------------------------------------
// Helper: detect if a string looks like raw JSON (starts with { or [)
// Used to catch cases where the model ignores the conversational instruction
// -----------------------------------------------------------------------------
function looksLikeJSON(text) {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

// -----------------------------------------------------------------------------
// POST /api/ai/insights
// Returns structured JSON highlights, tips, and anomalies
// -----------------------------------------------------------------------------
router.post('/insights', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.json(MOCK_INSIGHTS);
    }

    const snapshot = await getFinancialSnapshot(req.user.id);
    const groq = getGroqClient();

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate financial insights based on this data:\n\n${JSON.stringify(snapshot, null, 2)}`
        }
      ],
      temperature: 0.4,
      max_tokens: 1024,
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
        highlights: [{ label: 'Analysis', text: raw.substring(0, 300), type: 'info' }],
        tips: [],
        anomalies: [],
      });
    }
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/ai/chat
// Streams a conversational plain-text response as SSE
// -----------------------------------------------------------------------------
router.post('/chat', async (req, res) => {
  try {
    const { messages, financialContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A non-empty messages array is required.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.json({ role: 'assistant', content: 'AI advisor is unavailable. Please add a GROQ_API_KEY.' });
    }

    // Fetch snapshot from DB if frontend didn't send it
    const context = financialContext && Object.keys(financialContext).length > 0
      ? financialContext
      : await getFinancialSnapshot(req.user.id);

    const contextNote = `Here is the user's current financial data — use it to inform all responses. Do NOT repeat this data back to the user. Use it only to give personalised advice:\n\n${JSON.stringify(context, null, 2)}`;

    // Build Groq message array
    const groqMessages = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: contextNote },
      { role: 'assistant', content: 'Got it — I have your financial data and am ready to give you personalised advice.' },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    // Stream back as SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const groq = getGroqClient();

    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    let fullText = '';

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullText += text;

        // Safety check: if the model starts responding with JSON, stop and
        // send a friendly fallback instead of streaming raw JSON to the UI
        if (fullText.length < 50 && looksLikeJSON(fullText)) {
          res.write(`data: ${JSON.stringify({ text: "I'm analysing your finances. Here's what stands out: your recent transactions show some interesting patterns. Could you ask me something more specific, like 'How can I reduce my spending?' or 'Am I on track with my savings goals?'" })}\n\n`);
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