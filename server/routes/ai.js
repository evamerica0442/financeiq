const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const SYSTEM_PROMPT = `You are FinanceIQ, a personal financial advisor AI. You have access to the user's full financial data including their transactions, budgets, goals, assets, and liabilities.

Your job is to:
1. Detect patterns and anomalies in spending
2. Give concrete, actionable tips (not generic advice)
3. Project goal completion dates and suggest adjustments
4. Flag budget categories approaching or exceeding their limits
5. Highlight wins and positive trends
6. Answer questions about their finances in a friendly, clear way

Always reference specific numbers from their data. Be concise. Use South African Rand (R) as the currency unless the user's profile says otherwise.

For /insights, respond ONLY with valid JSON in this exact format and nothing else:
{
  "highlights": [{"label": "string", "text": "string", "type": "ok|warn|danger|info"}],
  "tips": [{"title": "string", "body": "string", "type": "ok|warn|danger"}],
  "anomalies": [{"text": "string"}]
}`;

// Helper to get user's financial snapshot
async function getFinancialSnapshot(userId) {
  const [transactions, budgets, goals, assets] = await Promise.all([
    pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 100', [userId]),
    pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM assets WHERE user_id = $1', [userId])
  ]);

  return {
    transactions: transactions.rows,
    budgets: budgets.rows,
    goals: goals.rows,
    assets: assets.rows
  };
}

// Get Gemini model instance
function getGeminiModel(apiKey, systemPrompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    systemInstruction: systemPrompt,
  });
  return model;
}

// POST /api/ai/insights
router.post('/insights', async (req, res) => {
  try {
    const { transactions, budgets, goals, assets } = req.body;

    const financialContext = {
      transactions: transactions || (await getFinancialSnapshot(req.user.id)).transactions,
      budgets: budgets || (await getFinancialSnapshot(req.user.id)).budgets,
      goals: goals || (await getFinancialSnapshot(req.user.id)).goals,
      assets: assets || (await getFinancialSnapshot(req.user.id)).assets
    };

    if (!process.env.GEMINI_API_KEY) {
      // Return mock insights if no API key configured
      return res.json({
        highlights: [
          { label: 'Income Trend', text: 'Your income appears stable this month.', type: 'ok' },
          { label: 'Savings Rate', text: 'Track your savings to build a healthy buffer.', type: 'info' }
        ],
        tips: [
          { title: 'Set a Budget', body: 'Consider setting category budgets to better track your spending.', type: 'info' }
        ],
        anomalies: []
      });
    }

    const model = getGeminiModel(process.env.GEMINI_API_KEY, SYSTEM_PROMPT);

    const result = await model.generateContent(
      `Generate financial insights based on this data:\n\n${JSON.stringify(financialContext, null, 2)}`
    );

    const textContent = result.response.text();
    
    // Try to extract JSON from the response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : textContent;
    
    try {
      const parsed = JSON.parse(jsonStr);
      res.json(parsed);
    } catch {
      res.json({
        highlights: [{ label: 'Analysis Complete', text: textContent.substring(0, 500), type: 'info' }],
        tips: [],
        anomalies: []
      });
    }
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { messages, financialContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Get context if not provided
    let context = financialContext;
    if (!context) {
      const snapshot = await getFinancialSnapshot(req.user.id);
      context = snapshot;
    }

    const contextMessage = `Here is my current financial data for context:\n\n${JSON.stringify(context, null, 2)}\n\nPlease use this to inform your responses.`;

    if (!process.env.GEMINI_API_KEY) {
      // Return mock response if no API key
      const lastMessage = messages[messages.length - 1]?.content || '';
      let mockResponse = '';
      if (lastMessage.includes('risk')) {
        mockResponse = 'Based on your financial data, your biggest financial risk appears to be lack of emergency savings. Consider building a 3-6 month emergency fund before making large investments.';
      } else if (lastMessage.includes('invest')) {
        mockResponse = 'Consider building an emergency fund first (3-6 months of expenses), then look into diversified investments like index funds or ETFs. Pay off high-interest debt before investing.';
      } else if (lastMessage.includes('independence')) {
        mockResponse = 'To reach financial independence, focus on: 1) Building an emergency fund, 2) Paying off high-interest debt, 3) Investing 15-20% of your income in diversified assets, 4) Reducing unnecessary expenses.';
      } else if (lastMessage.includes('budget')) {
        mockResponse = 'Your budget looks reasonable overall. I recommend tracking your discretionary spending categories like dining out and entertainment to ensure they align with your financial goals.';
      } else {
        mockResponse = 'Based on your financial data, I can see some key areas to focus on. Track your expenses carefully and review your budget categories to optimise your savings.';
      }
      
      res.json({ 
        role: 'assistant', 
        content: mockResponse 
      });
      return;
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const model = getGeminiModel(process.env.GEMINI_API_KEY, SYSTEM_PROMPT);

    // Convert messages to Gemini format (history + current turn)
    const history = [];
    const geminiMessages = [];

    // Add context as first user message
    geminiMessages.push({ role: 'user', parts: [{ text: contextMessage }] });

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      geminiMessages.push({ role, parts: [{ text: msg.content }] });
    }

    // Use sendMessageStream for proper streaming
    const chat = model.startChat({
      history: [],
    });

    // Send the full conversation in one go with streaming
    const fullPrompt = geminiMessages.map(m =>
      `${m.role === 'model' ? 'Assistant' : 'User'}: ${m.parts[0].text}`
    ).join('\n\n');

    const result = await model.generateContentStream(fullPrompt);

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
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate AI response.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error occurred.' })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;