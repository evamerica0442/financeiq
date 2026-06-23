const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Helper: resolve category_id from category name for the user.
 * Falls back to null if no matching category found.
 */
async function resolveCategoryId(userId, categoryName) {
  if (!categoryName) return null;
  const result = await pool.query(
    'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND is_active = TRUE LIMIT 1',
    [userId, categoryName]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// GET /api/transactions
// Supports: month=YYYY-MM, future=true (show only future transactions), status=future|actual|all
router.get('/', async (req, res) => {
  try {
    const { month, future, status } = req.query;
    let query = `
      SELECT t.*, 
        c.icon AS category_icon, 
        c.color AS category_color,
        cg.name AS group_name,
        cg.color AS group_color
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN category_groups cg ON cg.id = c.group_id
      WHERE t.user_id = $1`;
    let params = [req.user.id];
    let paramIndex = 2;

    if (future === 'true') {
      query += ` AND t.is_future = true`;
    } else if (status === 'all') {
      // Show all, no filtering on is_future
    } else if (status === 'future') {
      query += ` AND t.is_future = true`;
    } else {
      // Default: show only non-future (actual) transactions
      query += ` AND (t.is_future IS NULL OR t.is_future = false)`;
    }

    if (month) {
      query += ` AND to_char(t.date, 'YYYY-MM') = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// GET /api/transactions/future — convenience route for upcoming transactions
router.get('/future', async (req, res) => {
  try {
    const { month } = req.query;
    let query = `
      SELECT t.*, 
        c.icon AS category_icon, 
        c.color AS category_color,
        cg.name AS group_name,
        cg.color AS group_color
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN category_groups cg ON cg.id = c.group_id
      WHERE t.user_id = $1 AND t.is_future = true`;
    let params = [req.user.id];

    if (month) {
      query += ' AND to_char(t.date, \'YYYY-MM\') = $2';
      params.push(month);
    }

    query += ' ORDER BY t.date ASC, t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get future transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch future transactions.' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { name, amount, category, date, notes, is_future } = req.body;

    if (!name || amount === undefined || !category) {
      return res.status(400).json({ error: 'Name, amount, and category are required.' });
    }

    // Resolve category_id from category name
    const categoryId = await resolveCategoryId(req.user.id, category);

    const result = await pool.query(
      `INSERT INTO transactions (user_id, name, amount, category, category_id, date, notes, is_future)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, amount, category, categoryId, date || new Date().toISOString().split('T')[0], notes || null, is_future || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
});

// POST /api/transactions/move-to-actual/:id — move a future transaction to actual
router.post('/move-to-actual/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;

    const result = await pool.query(
      `UPDATE transactions
       SET is_future = false,
           date = COALESCE($1, date)
       WHERE id = $2 AND user_id = $3 AND is_future = true
       RETURNING *`,
      [date || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Future transaction not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Move to actual error:', err);
    res.status(500).json({ error: 'Failed to move transaction to actual.' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, category, date, notes, is_future } = req.body;

    // Verify ownership
    const existing = await pool.query('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    // Resolve category_id from category name
    const categoryId = category ? await resolveCategoryId(req.user.id, category) : undefined;

    const result = await pool.query(
      `UPDATE transactions 
       SET name = $1, amount = $2, category = COALESCE($3, category), 
           category_id = COALESCE($4, category_id),
           date = $5, notes = $6, is_future = COALESCE($7, is_future)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [name, amount, category, categoryId, date, notes, is_future, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

module.exports = router;