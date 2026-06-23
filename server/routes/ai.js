const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — instructs Gemini on behaviour for both /insights and /chat
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
// Fallback response when no GEMINI_API_KEY is configured
// -----------------------------------------------------------------------------
const MOCK_INSIGHTS = {
  highlights: [
    { label: 'AI Insights Unavailable', text: 'Add a GEMINI_API_KEY to your environment to enable AI-powered insights.', type: 'info' },
  ],
  tips: [
    { title: 'Get started', body: 'Visit aistudio.google.com to get a free Gemini API key — no credit card required.', type: 'info' }
  ],
  anomalies: []
};

// -----------------------------------------------------------------------------
// Helper: fetch user's complete financial snapshot from the database
// Called at most once per request — results are reused by both routes.
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
// Helper: initialise the Gemini model with the system instruction
// -----------------------------------------------------------------------------
function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
  });
}

// -----------------------------------------------------------------------------
// Helper: strip markdown code fences from a raw Gemini text response
// Gemini sometimes wraps JSON in ```json or ``` blocks even when
// the system prompt tells it not to. This safely extracts the JSON.
// -----------------------------------------------------------------------------
function stripMarkdownFences(raw) {
  return raw
    .replace(/^```json\s*/i, '')   // opening ```json
    .replace(/^```\s*/i, '')       // opening ``` (plain)
    .replace(/```\s*$/i, '')       // closing ```
    .trim();
}

// -----------------------------------------------------------------------------
// POST /api/ai/insights
// Generates a structured JSON summary (highlights, tips, anomalies) from the
// user's current financial data. Falls back to MOCK_INSIGHTS when no API key.
//
// Always fetches a complete snapshot from the DB — if the request body
// contains partial data, it is ignored in favour of the authoritative DB
// snapshot. This guarantees consistent, complete data every call.
// -----------------------------------------------------------------------------
router.post('/insights', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(MOCK_INSIGHTS);
    }

    // Fetch a complete, authoritative snapshot from the DB (single call)
    const snapshot = await getFinancialSnapshot(req.user.id);

    const model = getModel();
    const result = await model.generateContent(
      `Generate financial insights based on this data:\n\n${JSON.stringify(snapshot, null, 2)}`
    );

    const raw = result.response.text().trim();

    // Strip any markdown code fences that Gemini may have wrapped the JSON in
    const cleaned = stripMarkdownFences(raw);

    // Attempt to parse the cleaned text as JSON
    try {
      const parsed = JSON.parse(cleaned);
      return res.json(parsed);
    } catch {
      // If parsing fails, try to extract the first JSON object via regex
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return res.json(JSON.parse(match[0]));
        } catch { /* fall through to last resort */ }
      }

      // Last resort: wrap the raw text as a single highlight
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
// Streaming conversational AI endpoint. Accepts:
//   - messages:  array of { role: "user"|"assistant", content: "..." }
//   - financialContext:  optional pre-fetched snapshot from the frontend
//
// Uses Gemini's startChat({ history }) pattern for proper multi-turn context.
// The financial context is injected as the very first user turn so the model
// "sees" the data from the start. All past messages become part of history;
// only the final message is sent via sendMessageStream.
//
// Streams tokens back as server-sent events (SSE) with X-Accel-Buffering: no
// to prevent Nginx/Render from buffering the response.
// -----------------------------------------------------------------------------
router.post('/chat', async (req, res) => {
  try {
    const { messages, financialContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A non-empty messages array is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ role: 'assistant', content: MOCK_INSIGHTS.highlights[0].text });
    }

    // Fetch snapshot from DB once if the frontend didn't send it
    // (financialContext may be null, undefined, or an empty object)
    const context = financialContext && Object.keys(financialContext).length > 0
      ? financialContext
      : await getFinancialSnapshot(req.user.id);

    const contextNote = `Here is the user's current financial data — use it to inform all responses:\n\n${JSON.stringify(context, null, 2)}`;

    // ── Build Gemini chat history ──────────────────────────────────────────
    // Gemini requires history to alternate user/model turns and MUST NOT
    // include the final user message (that is passed to sendMessageStream).
    //
    // Layout:
    //   [0] user:  financial context snapshot
    //   [1] model: acknowledgement
    //   [2..n]     all past messages (alternating user / model)
    //
    // The last message in the provided array is sent via sendMessageStream.
    const history = [
      { role: 'user',  parts: [{ text: contextNote }] },
      { role: 'model', parts: [{ text: 'Understood. I have your full financial context and am ready to help.' }] },
    ];

    // Append all messages except the final one to history
    for (const msg of messages.slice(0, -1)) {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const lastMessage = messages[messages.length - 1].content;

    // ── Stream the response ────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // prevent Nginx / Render buffering

    const model = getModel();
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('AI chat error:', err);

    // If headers haven't been sent yet, respond with a standard JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate AI response.' });
    }

    // If streaming has already started, send an error event and close
    res.write(`data: ${JSON.stringify({ error: 'Stream error occurred.' })}\n\n`);
    res.end();
  }
});

module.exports = router;