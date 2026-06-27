const express = require('express');
const Groq = require('groq-sdk');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { buildCompactContext, getFinancialSnapshot } = require('../utils/buildCompactContext');

const router = express.Router();
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// Auto-tag keywords
// -----------------------------------------------------------------------------
const AUTO_TAGS = {
  'savings': ['save', 'saving', 'emergency fund', 'put away'],
  'debt': ['debt', 'loan', 'owe', 'repay', 'credit card', 'bond'],
  'goals': ['goal', 'target', 'plan', 'want to', 'dream', 'achieve'],
  'spending': ['spent', 'bought', 'purchase', 'shopping', 'expense'],
  'income': ['salary', 'income', 'earned', 'pay rise', 'bonus', 'freelance'],
  'investment': ['invest', 'shares', 'etf', 'stock', 'unit trust', 'ra ', 'retirement'],
  'stress': ['worried', 'anxious', 'scared', 'stress', 'struggling', 'overwhelmed'],
  'win': ['achieved', 'paid off', 'reached', 'saved up', 'proud', 'managed to'],
};

function autoDetectTags(content) {
  const lower = content.toLowerCase();
  const detected = [];
  for (const [tag, keywords] of Object.entries(AUTO_TAGS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        detected.push(tag);
        break;
      }
    }
  }
  return detected;
}

// -----------------------------------------------------------------------------
// GET /api/journal - list entries
// -----------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, tag, mood, search } = req.query;
    const userId = req.user.id;
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
    let paramIdx = 2;

    if (tag) {
      whereClause += ` AND $${paramIdx} = ANY(tags)`;
      params.push(tag);
      paramIdx++;
    }
    if (mood) {
      whereClause += ` AND mood = $${paramIdx}`;
      params.push(mood);
      paramIdx++;
    }
    if (search) {
      whereClause += ` AND (title ILIKE $${paramIdx} OR content ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM journal_entries ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM journal_entries ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      entries: result.rows,
      total,
      hasMore: offset + result.rows.length < total,
    });
  } catch (err) {
    console.error('Journal list error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entries.' });
  }
});

// -----------------------------------------------------------------------------
// GET /api/journal/summary/ai - AI analysis of recent entries
// -----------------------------------------------------------------------------
router.get('/summary/ai', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    const entries = result.rows;

    if (entries.length < 3) {
      return res.json({ summary: null, themes: [], entryCount: entries.length });
    }

    const snapshot = await getFinancialSnapshot(userId);
    const compactContext = buildCompactContext(snapshot);

    const entrySummaries = entries.map(e =>
      `--- Entry: "${e.title || 'Untitled'}" (${e.mood || 'no mood'})\nFirst 200 chars: ${(e.content || '').substring(0, 200)}`
    ).join('\n\n');

    if (!process.env.GROQ_API_KEY) {
      return res.json({
        summary: 'Add a GROQ_API_KEY to enable AI-powered journal summaries.',
        themes: [...new Set(entries.flatMap(e => e.tags || []))],
        entryCount: entries.length,
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are FinanceIQ. Analyse these journal entries and the user's finances to find patterns and give an overall summary. Plain text only, under 200 words. Be warm and encouraging.`,
        },
        {
          role: 'user',
          content: `Here are my last ${entries.length} journal entries:\n${entrySummaries}\n\nFinancial snapshot:\n${compactContext}\n\nPlease identify: 1) recurring themes or worries, 2) progress toward mentioned goals, 3) one key action to focus on this month.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || null;
    const allTags = [...new Set(entries.flatMap(e => e.tags || []))];

    res.json({ summary, themes: allTags, entryCount: entries.length });
  } catch (err) {
    console.error('Journal summary error:', err);
    res.status(500).json({ error: 'Failed to generate journal summary.' });
  }
});

// -----------------------------------------------------------------------------
// GET /api/journal/:id - single entry
// -----------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Journal get error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entry.' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/journal - create entry
// -----------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { title = '', content, mood = null, tags } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: 'Content must be 5000 characters or less.' });
    }

    let finalTags = tags;
    if (!finalTags || !Array.isArray(finalTags) || finalTags.length === 0) {
      finalTags = autoDetectTags(content);
    } else {
      finalTags = finalTags.map(t => t.toLowerCase().trim()).filter(Boolean);
    }

    const result = await pool.query(
      `INSERT INTO journal_entries (user_id, title, content, mood, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title.trim(), content.trim(), mood, finalTags]
    );

    res.status(201).json(result.rows[0]);
router.put('/:id', async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found.' });
    }

    const { title, content, mood, tags } = req.body;
    const entry = existing.rows[0];

    const newTitle = title !== undefined ? title.trim() : entry.title;
    const newContent = content !== undefined ? content.trim() : entry.content;
    const newMood = mood !== undefined ? mood : entry.mood;
    let newTags = tags !== undefined ? tags.map(t => t.toLowerCase().trim()).filter(Boolean) : entry.tags;

    const contentChanged = newContent !== entry.content;
    const clearInsight = contentChanged ? ', ai_insight = NULL, ai_insight_generated_at = NULL' : '';

    const result = await pool.query(
      `UPDATE journal_entries
       SET title = $1, content = $2, mood = $3, tags = $4, updated_at = NOW()${clearInsight}
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [newTitle, newContent, newMood, newTags, req.params.id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Journal update error:', err);
    res.status(500).json({ error: 'Failed to update journal entry.' });
  }
});

// -----------------------------------------------------------------------------
// DELETE /api/journal/:id - delete entry
// -----------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found.' });
    }
    res.json({ message: 'Journal entry deleted.' });
  } catch (err) {
    console.error('Journal delete error:', err);
    res.status(500).json({ error: 'Failed to delete journal entry.' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/journal/:id/insight - generate AI insight for an entry
// -----------------------------------------------------------------------------
router.post('/:id/insight', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found.' });
    }

    const entry = result.rows[0];
    const force = req.query.force === 'true';

    if (!force && entry.ai_insight && entry.ai_insight_generated_at) {
      const age = Date.now() - new Date(entry.ai_insight_generated_at).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return res.json({ insight: entry.ai_insight, cached: true });
      }
    }

    if (!process.env.GROQ_API_KEY) {
      return res.json({ insight: null, error: 'AI insights require a GROQ_API_KEY.' });
    }

    const snapshot = await getFinancialSnapshot(req.user.id);
    const compactContext = buildCompactContext(snapshot);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are FinanceIQ, a supportive and insightful personal finance AI.
A user has written a journal entry about their financial life.
Your job is to:
1. Acknowledge what they've written with empathy
2. Connect their thoughts/plans to their actual financial data
3. Give 1-2 specific, actionable suggestions based on what they wrote
4. If they expressed stress or worry, be encouraging and constructive
5. If they mentioned a goal or plan, validate it and suggest how to make it concrete

Keep your response under 120 words. Be warm, personal, and specific - not generic.
Use Rand (R) for amounts. Do NOT return JSON. Plain conversational text only.`,
        },
        {
          role: 'user',
          content: `Journal entry titled "${entry.title}":\n\n"${entry.content}"\n\nTheir current financial snapshot:\n${compactContext}\n\nPlease give a brief, personalised insight about this journal entry.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    const insight = completion.choices[0]?.message?.content?.trim() || null;

    if (insight) {
      await pool.query(
        'UPDATE journal_entries SET ai_insight = $1, ai_insight_generated_at = NOW() WHERE id = $2',
        [insight, entry.id]
      );
    }

    res.json({ insight, cached: false });
  } catch (err) {
    console.error('Journal insight error:', err);
    res.json({ insight: null, error: 'Could not generate insight right now. Try again later.' });
  }
});

module.exports = router;
