const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getNetWorthForUser,
  takeMonthlySnapshot,
  syncCashFromTransactions,
  getNetworthHistory,
  getNetworthInsights,
} = require('../services/networthService');

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

// GET /api/networth/history?months=12
router.get('/history', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const history = await getNetworthHistory(req.user.id, months);
    res.json(history);
  } catch (err) {
    console.error('Get net worth history error:', err);
    res.status(500).json({ error: 'Failed to fetch net worth history.' });
  }
});

// GET /api/networth/summary — single source of truth for net worth
router.get('/summary', async (req, res) => {
  try {
    const { totalAssets, totalLiabilities, netWorth } = await getNetWorthForUser(req.user.id);
    res.json({ totalAssets, totalLiabilities, netWorth });
  } catch (err) {
    console.error('Get net worth summary error:', err);
    res.status(500).json({ error: 'Failed to fetch net worth summary.' });
  }
});

// GET /api/networth/insights
router.get('/insights', async (req, res) => {
  try {
    const insights = await getNetworthInsights(req.user.id);
    res.json(insights);
  } catch (err) {
    console.error('Get net worth insights error:', err);
    res.status(500).json({ error: 'Failed to fetch net worth insights.' });
  }
});

// POST /api/networth/snapshot — manually trigger a snapshot
router.post('/snapshot', async (req, res) => {
  try {
    const snapshot = await takeMonthlySnapshot(req.user.id);
    res.json(snapshot);
  } catch (err) {
    console.error('Take snapshot error:', err);
    res.status(500).json({ error: 'Failed to take net worth snapshot.' });
  }
});

// POST /api/networth/sync — manually trigger transaction sync
router.post('/sync', async (req, res) => {
  try {
    const updated = await syncCashFromTransactions(req.user.id);
    res.json({ updated, count: updated.length });
  } catch (err) {
    console.error('Sync transactions error:', err);
    res.status(500).json({ error: 'Failed to sync transactions.' });
  }
});

// POST /api/networth
router.post('/', async (req, res) => {
  try {
    const { name, value, type, asset_type, depreciation_rate, linked_category, notes } = req.body;

    if (!name || value === undefined || !type) {
      return res.status(400).json({ error: 'Name, value, and type are required.' });
    }

    if (!['asset', 'liability'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "asset" or "liability".' });
    }

    const result = await pool.query(
      `INSERT INTO assets (user_id, name, value, type, asset_type, depreciation_rate, linked_category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, value, type, asset_type || 'other', depreciation_rate || 0, linked_category || null, notes || null]
    );

    // Trigger a snapshot after creation
    try {
      await takeMonthlySnapshot(req.user.id);
    } catch (snapErr) {
      // Don't fail the request if snapshot fails
      console.error('Snapshot after create error:', snapErr.message);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ error: 'Failed to add asset/liability.' });
  }
});

// PUT /api/networth/assets/:id
router.put('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, asset_type, depreciation_rate, linked_category, notes } = req.body;

    const existing = await pool.query('SELECT * FROM assets WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Asset/liability not found.' });
    }

    const current = existing.rows[0];
    const oldValue = Number(current.value);

    const result = await pool.query(
      `UPDATE assets SET name = $1, value = $2, asset_type = $3, depreciation_rate = $4,
       linked_category = $5, notes = $6, updated_at = NOW()
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [
        name || current.name,
        value !== undefined ? value : current.value,
        asset_type || current.asset_type || 'other',
        depreciation_rate !== undefined ? depreciation_rate : (current.depreciation_rate || 0),
        linked_category !== undefined ? linked_category : current.linked_category,
        notes !== undefined ? notes : current.notes,
        id,
        req.user.id
      ]
    );

    // Log the change to asset_history
    const newValue = Number(result.rows[0].value);
    if (oldValue !== newValue) {
      await pool.query(
        `INSERT INTO asset_history (asset_id, user_id, old_value, new_value, change_reason)
         VALUES ($1, $2, $3, $4, 'manual')`,
        [id, req.user.id, oldValue, newValue]
      );
    }

    // Trigger a snapshot after update
    try {
      await takeMonthlySnapshot(req.user.id);
    } catch (snapErr) {
      console.error('Snapshot after update error:', snapErr.message);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update asset error:', err);
    res.status(500).json({ error: 'Failed to update asset/liability.' });
  }
});

// PUT /api/networth/:id (legacy route — keep for backward compatibility)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, type, asset_type, depreciation_rate, linked_category, notes } = req.body;

    const existing = await pool.query('SELECT * FROM assets WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Asset/liability not found.' });
    }

    const current = existing.rows[0];
    const oldValue = Number(current.value);

    const result = await pool.query(
      `UPDATE assets SET name = $1, value = $2, type = $3, asset_type = $4, depreciation_rate = $5,
       linked_category = $6, notes = $7, updated_at = NOW()
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [
        name || current.name,
        value !== undefined ? value : current.value,
        type || current.type,
        asset_type || current.asset_type || 'other',
        depreciation_rate !== undefined ? depreciation_rate : (current.depreciation_rate || 0),
        linked_category !== undefined ? linked_category : current.linked_category,
        notes !== undefined ? notes : current.notes,
        id,
        req.user.id
      ]
    );

    // Log the change to asset_history
    const newValue = Number(result.rows[0].value);
    if (oldValue !== newValue) {
      await pool.query(
        `INSERT INTO asset_history (asset_id, user_id, old_value, new_value, change_reason)
         VALUES ($1, $2, $3, $4, 'manual')`,
        [id, req.user.id, oldValue, newValue]
      );
    }

    // Trigger a snapshot after update
    try {
      await takeMonthlySnapshot(req.user.id);
    } catch (snapErr) {
      console.error('Snapshot after update error:', snapErr.message);
    }

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

    // Trigger a snapshot after deletion
    try {
      await takeMonthlySnapshot(req.user.id);
    } catch (snapErr) {
      console.error('Snapshot after delete error:', snapErr.message);
    }

    res.json({ message: 'Asset/liability deleted successfully.' });
  } catch (err) {
    console.error('Delete asset error:', err);
    res.status(500).json({ error: 'Failed to delete asset/liability.' });
  }
});

// GET /api/networth/history/:assetId — get value history for a specific asset
router.get('/history/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const result = await pool.query(
      `SELECT * FROM asset_history
       WHERE asset_id = $1 AND user_id = $2
       ORDER BY changed_at DESC
       LIMIT 12`,
      [assetId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get asset history error:', err);
    res.status(500).json({ error: 'Failed to fetch asset history.' });
  }
});

module.exports = router;