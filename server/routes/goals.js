const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get goals error:', err);
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const { name, target_amount, saved_amount, monthly_contribution, target_date } = req.body;

    if (!name || target_amount === undefined) {
      return res.status(400).json({ error: 'Name and target_amount are required.' });
    }

    const result = await pool.query(
      `INSERT INTO goals (user_id, name, target_amount, saved_amount, monthly_contribution, target_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, name, target_amount, saved_amount || 0, monthly_contribution || 0, target_date || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, target_amount, saved_amount, monthly_contribution, target_date } = req.body;

    const existing = await pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const result = await pool.query(
      `UPDATE goals SET name = $1, target_amount = $2, saved_amount = $3, monthly_contribution = $4, target_date = $5
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, target_amount, saved_amount, monthly_contribution, target_date, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update goal error:', err);
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    res.json({ message: 'Goal deleted successfully.' });
  } catch (err) {
    console.error('Delete goal error:', err);
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

module.exports = router;