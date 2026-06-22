const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/networth
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM assets WHERE user_id = $1 ORDER BY type, name',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets and liabilities.' });
  }
});

// POST /api/networth
router.post('/', async (req, res) => {
  try {
    const { name, value, type } = req.body;

    if (!name || value === undefined || !type) {
      return res.status(400).json({ error: 'Name, value, and type are required.' });
    }

    if (!['asset', 'liability'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "asset" or "liability".' });
    }

    const result = await pool.query(
      'INSERT INTO assets (user_id, name, value, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, name, value, type]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ error: 'Failed to add asset/liability.' });
  }
});

// PUT /api/networth/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, type } = req.body;

    const existing = await pool.query('SELECT id FROM assets WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Asset/liability not found.' });
    }

    const result = await pool.query(
      'UPDATE assets SET name = $1, value = $2, type = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, value, type, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update asset error:', err);
    res.status(500).json({ error: 'Failed to update asset/liability.' });
  }
});

// DELETE /api/networth/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM assets WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset/liability not found.' });
    }

    res.json({ message: 'Asset/liability deleted successfully.' });
  } catch (err) {
    console.error('Delete asset error:', err);
    res.status(500).json({ error: 'Failed to delete asset/liability.' });
  }
});

module.exports = router;