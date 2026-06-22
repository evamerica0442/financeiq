const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/budgets
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 ORDER BY category',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get budgets error:', err);
    res.status(500).json({ error: 'Failed to fetch budgets.' });
  }
});

// POST /api/budgets (upsert)
router.post('/', async (req, res) => {
  try {
    const { category, monthly_limit } = req.body;

    if (!category || monthly_limit === undefined) {
      return res.status(400).json({ error: 'Category and monthly_limit are required.' });
    }

    // Upsert: insert or update on conflict (user_id, category)
    const result = await pool.query(
      `INSERT INTO budgets (user_id, category, monthly_limit)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category)
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
       RETURNING *`,
      [req.user.id, category, monthly_limit]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upsert budget error:', err);
    res.status(500).json({ error: 'Failed to save budget.' });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    res.json({ message: 'Budget deleted successfully.' });
  } catch (err) {
    console.error('Delete budget error:', err);
    res.status(500).json({ error: 'Failed to delete budget.' });
  }
});

module.exports = router;