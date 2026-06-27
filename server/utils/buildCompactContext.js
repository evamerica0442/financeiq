const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getFinancialSnapshot(userId) {
  const [transactions, budgets, goals, assets] = await Promise.all([
    pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 100', [userId]),
    pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM assets WHERE user_id = $1', [userId]),
  ]);
  return {
    transactions: transactions.rows,
    budgets: budgets.rows,
    goals: goals.rows,
    assets: assets.rows,
  };
}

function buildCompactContext(snapshot) {
  const { transactions = [], budgets = [], goals = [], assets = [] } = snapshot;

  // ── Income & expenses this month ──
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyTxns = transactions.filter(t => t.date && t.date.toString().startsWith(thisMonth));

  const income = monthlyTxns
    .filter(t => parseFloat(t.amount) > 0)
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const expenses = monthlyTxns
    .filter(t => parseFloat(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  // ── Spending by category ──
  const byCategory = {};
  monthlyTxns.filter(t => parseFloat(t.amount) < 0).forEach(t => {
    const cat = t.category || 'Uncategorised';
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(parseFloat(t.amount));
  });

  const sortedCats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topExpenses = sortedCats.map(([cat, amt]) => `${cat}: R${amt.toFixed(0)}`).join(', ');

  // ── Budgets ──
  const budgetInfo = budgets.map(b => {
    const spent = Math.abs(
      monthlyTxns
        .filter(t => parseFloat(t.amount) < 0 && (t.category || 'Uncategorised') === b.category)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
    );
    return `${b.category}: R${spent.toFixed(0)} / R${parseFloat(b.monthly_limit).toFixed(0)}`;
  }).join(' | ');

  // ── Goals ──
  const goalInfo = goals.map(g => {
    const pct = parseFloat(g.target_amount) > 0
      ? Math.round((parseFloat(g.saved_amount || 0) / parseFloat(g.target_amount)) * 100)
      : 0;
    return `${g.name}: ${pct}% (R${parseFloat(g.saved_amount || 0).toFixed(0)} / R${parseFloat(g.target_amount).toFixed(0)})`;
  }).join(' | ');

  // ── Assets & Liabilities ──
  const assetInfo = assets.map(a =>
    `${a.name || a.asset_type}: R${parseFloat(a.value || 0).toFixed(0)} (${a.type === 'liability' ? 'Liability' : 'Asset'})`
  ).join(' | ');

  return [
    `Income this month: R${income.toFixed(0)}`,
    `Expenses this month: R${expenses.toFixed(0)}`,
    `Top spending categories: ${topExpenses || 'None'}`,
    `Budgets: ${budgetInfo || 'None set'}`,
    `Goals: ${goalInfo || 'None set'}`,
    `Assets/Liabilities: ${assetInfo || 'None recorded'}`,
  ].join('\n');
}

module.exports = { buildCompactContext, getFinancialSnapshot };
