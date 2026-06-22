const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    let params = [req.user.id];

    if (month) {
      query += ' AND to_char(date, \'YYYY-MM\') = $2';
      params.push(month);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { name, amount, category, date, notes } = req.body;

    if (!name || amount === undefined || !category) {
      return res.status(400).json({ error: 'Name, amount, and category are required.' });
    }

    const result = await pool.query(
      'INSERT INTO transactions (user_id, name, amount, category, date, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, name, amount, category, date || new Date().toISOString().split('T')[0], notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, category, date, notes } = req.body;

    // Verify ownership
    const existing = await pool.query('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const result = await pool.query(
      'UPDATE transactions SET name = $1, amount = $2, category = $3, date = $4, notes = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
      [name, amount, category, date, notes, id, req.user.id]
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