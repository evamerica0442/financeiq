const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * CSV export route for monthly reports.
 * Primary format is CSV (opens fine in Excel/Google Sheets).
 * Transform helper converts transaction rows to CSV-compatible format.
 */
const { Parser } = require('json2csv');

const router = express.Router();
router.use(authMiddleware);

// GET /api/reports/group-spending?month=YYYY-MM
// Returns total spending grouped by category group, with percentages
router.get('/group-spending', async (req, res) => {
  try {
    const { month } = req.query;
    const userId = req.user.id;

    // Get all groups for THIS user only
    const groupsResult = await pool.query(
      'SELECT id, name, icon, color FROM category_groups WHERE user_id = $1 ORDER BY sort_order, name',
      [userId]
    );
    const groups = groupsResult.rows;

    // Get all categories with their group mapping for THIS user only
    const catResult = await pool.query(
      'SELECT c.name, c.group_id FROM categories c JOIN category_groups g ON c.group_id = g.id WHERE c.user_id = $1',
      [userId]
    );
    const catToGroup = {};
    for (const row of catResult.rows) {
      catToGroup[row.name] = row.group_id;
    }

    // Get expenses for the month
    let query = 'SELECT category, SUM(ABS(amount)) as total FROM transactions WHERE user_id = $1 AND amount < 0';
    let params = [userId];

    if (month) {
      query += ' AND to_char(date, \'YYYY-MM\') = $2';
      params.push(month);
    }

    // Only include non-future transactions
    query += ' AND (is_future IS NULL OR is_future = false)';
    query += ' GROUP BY category ORDER BY total DESC';

    const txResult = await pool.query(query, params);
    const expensesByCategory = {};
    let totalSpent = 0;

    for (const row of txResult.rows) {
      const amt = parseFloat(row.total);
      expensesByCategory[row.category] = amt;
      totalSpent += amt;
    }

    // Aggregate into groups
    const groupSpending = {};
    for (const group of groups) {
      groupSpending[group.id] = {
        groupId: group.id,
        groupName: group.name,
        icon: group.icon,
        color: group.color,
        total: 0,
        categories: [],
      };
    }

    // Add ungrouped category spending
    groupSpending['ungrouped'] = {
      groupId: null,
      groupName: 'Uncategorized',
      icon: '📦',
      color: '#8B92A5',
      total: 0,
      categories: [],
    };

    for (const [catName, amount] of Object.entries(expensesByCategory)) {
      const gId = catToGroup[catName];
      if (gId && groupSpending[gId]) {
        groupSpending[gId].categories.push({ name: catName, amount });
        groupSpending[gId].total += amount;
      } else {
        groupSpending['ungrouped'].categories.push({ name: catName, amount });
        groupSpending['ungrouped'].total += amount;
      }
    }

    // Build result array and calculate percentages
    const result = Object.values(groupSpending)
      .filter(g => g.categories.length > 0)
      .sort((a, b) => b.total - a.total)
      .map(g => ({
        ...g,
        total: Math.round(g.total * 100) / 100,
        percentage: totalSpent > 0 ? Math.round((g.total / totalSpent) * 1000) / 10 : 0,
        categories: g.categories
          .map(c => ({
            name: c.name,
            amount: Math.round(c.amount * 100) / 100,
            percentage: g.total > 0 ? Math.round((c.amount / g.total) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      }));

    // If there's an "Other" group, push it to the end
    const otherIdx = result.findIndex(g => g.groupName === 'Other' || g.groupName === 'Uncategorized');
    if (otherIdx > -1) {
      const other = result.splice(otherIdx, 1)[0];
      result.push(other);
    }

    res.json({
      totalSpent: Math.round(totalSpent * 100) / 100,
      groups: result,
      month: month || new Date().toISOString().slice(0, 7),
    });
  } catch (err) {
    console.error('Group spending report error:', err);
    res.status(500).json({ error: 'Failed to generate spending report.' });
  }
});

// GET /api/reports/monthly-summary?month=YYYY-MM
// Returns income, expenses, savings for a given month
router.get('/monthly-summary', async (req, res) => {
  try {
    const { month } = req.query;
    const userId = req.user.id;

    let incomeQuery = 'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND amount > 0';
    let expenseQuery = 'SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE user_id = $1 AND amount < 0';
    let params = [userId];

    if (month) {
      incomeQuery += ' AND to_char(date, \'YYYY-MM\') = $2';
      expenseQuery += ' AND to_char(date, \'YYYY-MM\') = $2';
      params.push(month);
    }

    // Exclude future transactions
    incomeQuery += ' AND (is_future IS NULL OR is_future = false)';
    expenseQuery += ' AND (is_future IS NULL OR is_future = false)';

    const incomeResult = await pool.query(incomeQuery, params);
    const expenseResult = await pool.query(expenseQuery, params);

    const income = parseFloat(incomeResult.rows[0].total);
    const expenses = parseFloat(expenseResult.rows[0].total);

    res.json({
      month: month || new Date().toISOString().slice(0, 7),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      savings: Math.round((income - expenses) * 100) / 100,
      savingsRate: income > 0 ? Math.round(((income - expenses) / income) * 1000) / 10 : 0,
    });
  } catch (err) {
    console.error('Monthly summary error:', err);
    res.status(500).json({ error: 'Failed to generate monthly summary.' });
  }
});

/**
 * GET /api/reports/monthly/export?format=csv&month=YYYY-MM
 * Exports monthly report data as a downloadable CSV file.
 * Fields: Date, Description, Category, Type, Amount
 */
router.get('/monthly/export', async (req, res) => {
  try {
    const { month, format } = req.query;
    const userId = req.user.id;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Fetch all transactions for the month (non-future only)
    const txResult = await pool.query(
      `SELECT date, name, category,
              CASE WHEN amount > 0 THEN 'income' ELSE 'expense' END as type,
              ABS(amount) as amount,
              notes
       FROM transactions
       WHERE user_id = $1
         AND to_char(date, 'YYYY-MM') = $2
         AND (is_future IS NULL OR is_future = false)
       ORDER BY date DESC, id DESC`,
      [userId, targetMonth]
    );

    const rows = txResult.rows.map(r => ({
      Date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      Description: r.name,
      Category: r.category,
      Type: r.type,
      Amount: parseFloat(r.amount).toFixed(2),
      Notes: r.notes || '',
    }));

    if (format === 'xls') {
      // XLS support: send as tab-separated values (TSV) with .xls extension
      // Most spreadsheet apps open TSV as Excel-compatible
      const header = 'Date\tDescription\tCategory\tType\tAmount\tNotes\n';
      const body = rows.map(r =>
        [r.Date, r.Description, r.Category, r.Type, r.Amount, r.Notes].join('\t')
      ).join('\n');

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${targetMonth}.xls"`);
      return res.send(header + body);
    }

    // Default: CSV
    const csvParser = new Parser({
      fields: ['Date', 'Description', 'Category', 'Type', 'Amount', 'Notes'],
    });
    const csv = csvParser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${targetMonth}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export report error:', err);
    res.status(500).json({ error: 'Failed to export report.' });
  }
});

module.exports = router;
