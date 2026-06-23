const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/analysis/spend-by-group?month=YYYY-MM
// Returns total expense amount for the month, plus per-group breakdown
// with percentage of total (rounded to 1 decimal place).
// Includes a pseudo "Unassigned" group for categories not in any group.
router.get('/spend-by-group', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const userId = req.user.id;

    // Get all expense transactions for the user's categories this month
    // Only expenses (amount < 0) are considered for "spend" analysis.
    const query = `
      SELECT
        t.category_id,
        t.category AS category_name,
        ABS(t.amount) AS abs_amount,
        c.group_id,
        cg.name AS group_name,
        cg.color AS group_color
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = $1
      LEFT JOIN category_groups cg ON cg.id = c.group_id AND cg.user_id = $1
      WHERE t.user_id = $1
        AND t.amount < 0
        AND t.is_future = FALSE
        AND to_char(t.date, 'YYYY-MM') = $2
    `;

    const result = await pool.query(query, [userId, targetMonth]);
    const rows = result.rows;

    // Aggregate by group
    const groupMap = {};
    let grandTotal = 0;

    for (const row of rows) {
      const groupId = row.group_id;
      const groupName = row.group_name || 'Unassigned';
      const groupColor = row.group_color || '#8B92A5';
      const key = groupId ? `g_${groupId}` : `u_${groupName}`;

      if (!groupMap[key]) {
        groupMap[key] = {
          groupId: groupId || null,
          groupName,
          groupColor,
          totalAmount: 0,
        };
      }
      groupMap[key].totalAmount += parseFloat(row.abs_amount);
      grandTotal += parseFloat(row.abs_amount);
    }

    // Build response array sorted by totalAmount descending
    const groups = Object.values(groupMap).sort((a, b) => b.totalAmount - a.totalAmount);

    const response = {
      month: targetMonth,
      grandTotal: Math.round(grandTotal * 100) / 100,
      groups: groups.map(g => ({
        ...g,
        totalAmount: Math.round(g.totalAmount * 100) / 100,
        percentageOfTotal: grandTotal > 0
          ? Math.round((g.totalAmount / grandTotal) * 1000) / 10  // rounded to 1 decimal
          : 0,
      })),
    };

    res.json(response);
  } catch (err) {
    console.error('Spend by group error:', err);
    res.status(500).json({ error: 'Failed to calculate spend by group.' });
  }
});

// ─── GET /api/analysis/spend-context?month=YYYY-MM
// Returns current month totals per group and per category for AI context.
router.get('/spend-context', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const userId = req.user.id;

    // Per-group spend (expenses only)
    const groupQuery = `
      SELECT
        COALESCE(cg.name, 'Unassigned') AS group_name,
        COALESCE(cg.color, '#8B92A5') AS group_color,
        SUM(ABS(t.amount)) AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = $1
      LEFT JOIN category_groups cg ON cg.id = c.group_id AND cg.user_id = $1
      WHERE t.user_id = $1
        AND t.amount < 0
        AND t.is_future = FALSE
        AND to_char(t.date, 'YYYY-MM') = $2
      GROUP BY cg.name, cg.color
      ORDER BY total DESC
    `;
    const groupsResult = await pool.query(groupQuery, [userId, targetMonth]);

    // Per-category spend (expenses only)
    const catQuery = `
      SELECT
        t.category AS category_name,
        c.icon AS category_icon,
        c.color AS category_color,
        SUM(ABS(t.amount)) AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = $1
      WHERE t.user_id = $1
        AND t.amount < 0
        AND t.is_future = FALSE
        AND to_char(t.date, 'YYYY-MM') = $2
      GROUP BY t.category, c.icon, c.color
      ORDER BY total DESC
    `;
    const catsResult = await pool.query(catQuery, [userId, targetMonth]);

    res.json({
      month: targetMonth,
      groups: groupsResult.rows.map(r => ({
        groupName: r.group_name,
        groupColor: r.group_color,
        total: parseFloat(r.total) || 0,
      })),
      categories: catsResult.rows.map(r => ({
        categoryName: r.category_name,
        icon: r.category_icon || '📦',
        color: r.category_color || '#8B92A5',
        total: parseFloat(r.total) || 0,
      })),
    });
  } catch (err) {
    console.error('Spend context error:', err);
    res.status(500).json({ error: 'Failed to fetch spend context.' });
  }
});

module.exports = router;