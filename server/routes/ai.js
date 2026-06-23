const express = require('express');
const Groq = require('groq-sdk');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// SYSTEM PROMPT
// -----------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are FinanceIQ, a personal financial advisor AI. You have access to the user's full financial data including their transactions, budgets, goals, assets, and liabilities.

Your job is to:
1. Detect patterns and anomalies in spending
2. Give concrete, actionable tips (not generic advice)
3. Project goal completion dates and suggest adjustments
4. Flag budget categories approaching or exceeding their limits
5. Highlight wins and positive trends
6. Answer questions about their finances in a friendly, clear way

Always reference specific numbers from their data. Be concise. Use South African Rand (R) as the currency unless the user's profile says otherwise.

For /insights, respond ONLY with valid JSON in this exact format and nothing else — no markdown, no backticks, no explanation:
{
  "highlights": [{"label": "string", "text": "string", "type": "ok|warn|danger|info"}],
  "tips": [{"title": "string", "body": "string", "type": "ok|warn|danger"}],
  "anomalies": [{"text": "string"}]
}`;

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
  const [transactions, budgets, goals, assets] = await Promise.all([
    pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 100', [userId]),
    pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM assets WHERE user_id = $1', [userId]),
  ]);
  return {
    transactions: transactions.rows,
    budgets: budgets.rows,
    goals: goals.rows,
    assets: assets.rows,
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
// POST /api/ai/insights
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
        { role: 'system', content: SYSTEM_PROMPT },
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
      const parsed = JSON.parse(cleaned);
      return res.json(parsed);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return res.json(JSON.parse(match[0]));
        } catch { /* fall through */ }
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

    // Fetch snapshot from DB if frontend didn't send it
    const context = financialContext && Object.keys(financialContext).length > 0
      ? financialContext
      : await getFinancialSnapshot(req.user.id);

    const contextNote = `Here is the user's current financial data — use it to inform all responses:\n\n${JSON.stringify(context, null, 2)}`;

    // Build Groq message array: system + context + conversation history
    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextNote },
      { role: 'assistant', content: 'Understood. I have your full financial context and am ready to help.' },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    // Stream the response back as SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // prevent Nginx/Render buffering

    const groq = getGroqClient();

    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
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