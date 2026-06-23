const pool = require('../db');

/**
 * Net worth calculation — single source of truth.
 *
 * Net worth is now calculated as total assets (including cash/bank accounts)
 * minus total liabilities for the authenticated user.
 *
 * How it works:
 * - The `assets` table stores both assets (type='asset') and liabilities (type='liability').
 * - Asset types include cash, savings, investment, property, vehicle, other.
 *   Cash/bank accounts (asset_type='cash'|'savings') are included in totalAssets.
 * - Liability types include home_loan, vehicle_finance, personal_loan, credit_card, store_account, other.
 * - totalAssets    = SUM of all rows where type = 'asset'.
 * - totalLiabilities = SUM(|value|) of all rows where type = 'liability'
 *     (abs because value may be stored negative, e.g. -50000 for a loan).
 * - netWorth       = totalAssets - totalLiabilities.
 *
 * This function is the canonical source of truth. All routes and frontend
 * components should call getNetWorthForUser() rather than recomputing locally.
 */
async function getUserTotals(userId) {
  const result = await pool.query(
    'SELECT * FROM assets WHERE user_id = $1 ORDER BY type, name',
    [userId]
  );
  const items = result.rows;
  const totalAssets = items
    .filter(a => a.type === 'asset')
    .reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = items
    .filter(a => a.type === 'liability')
    .reduce((sum, a) => sum + Math.abs(Number(a.value)), 0);
  const netWorth = totalAssets - totalLiabilities;
  return { items, totalAssets, totalLiabilities, netWorth };
}

/**
 * getNetWorthForUser — canonical alias for getUserTotals.
 * Returns { items, totalAssets, totalLiabilities, netWorth }.
 * All routes should call this rather than recomputing locally.
 */
const getNetWorthForUser = getUserTotals;

/**
 * takeMonthlySnapshot(userId)
 * Fetches all assets and liabilities for the user, calculates totals,
 * upserts a row into networth_snapshots for today's date.
 * Returns the snapshot object.
 */
async function takeMonthlySnapshot(userId) {
  const { totalAssets, totalLiabilities, netWorth } = await getUserTotals(userId);
  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `INSERT INTO networth_snapshots (user_id, snapshot_date, total_assets, total_liabilities, net_worth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, snapshot_date)
     DO UPDATE SET total_assets = EXCLUDED.total_assets,
                   total_liabilities = EXCLUDED.total_liabilities,
                   net_worth = EXCLUDED.net_worth,
                   created_at = NOW()
     RETURNING *`,
    [userId, today, totalAssets, totalLiabilities, netWorth]
  );

  return result.rows[0];
}

/**
 * syncCashFromTransactions(userId)
 * Finds all assets where linked_category is not null.
 * For each linked asset, queries the sum of all transactions in that category
 * for the current month. Updates the asset's value to reflect the running balance.
 * Logs changes in asset_history.
 * Returns array of updated assets.
 */
async function syncCashFromTransactions(userId) {
  const linkedAssets = await pool.query(
    `SELECT * FROM assets
     WHERE user_id = $1 AND linked_category IS NOT NULL AND type = 'asset'`,
    [userId]
  );

  const updated = [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const startDate = currentMonth + '-01';

  // Calculate end of month
  const year = parseInt(currentMonth.split('-')[0]);
  const month = parseInt(currentMonth.split('-')[1]);
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  for (const asset of linkedAssets.rows) {
    // Get sum of transactions in the linked category for this month
    const txnResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = $1
         AND category = $2
         AND date >= $3
         AND date <= $4
         AND (is_future IS NULL OR is_future = false)`,
      [userId, asset.linked_category, startDate, endDate]
    );

    const runningBalance = Number(txnResult.rows[0].total);
    const oldValue = Number(asset.value);
    const newValue = Math.abs(runningBalance); // Use absolute value for asset worth

    if (oldValue !== newValue) {
      const updateResult = await pool.query(
        `UPDATE assets
         SET value = $1, last_auto_updated = NOW(), updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [newValue, asset.id, userId]
      );

      await pool.query(
        `INSERT INTO asset_history (asset_id, user_id, old_value, new_value, change_reason)
         VALUES ($1, $2, $3, $4, 'transaction_sync')`,
        [asset.id, userId, oldValue, newValue]
      );

      updated.push(updateResult.rows[0]);
    }
  }

  return updated;
}

/**
 * applyVehicleDepreciation(userId)
 * Finds all assets where asset_type = 'vehicle' and depreciation_rate > 0.
 * Calculates monthly depreciation and applies it if not already updated this month.
 * Logs changes in asset_history.
 * Returns array of depreciated assets.
 */
async function applyVehicleDepreciation(userId) {
  const vehicles = await pool.query(
    `SELECT * FROM assets
     WHERE user_id = $1 AND asset_type = 'vehicle' AND depreciation_rate > 0 AND type = 'asset'`,
    [userId]
  );

  const depreciated = [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const vehicle of vehicles.rows) {
    // Only apply if not already auto-updated this month
    const lastUpdated = vehicle.last_auto_updated ? new Date(vehicle.last_auto_updated) : null;
    if (lastUpdated && lastUpdated >= currentMonthStart) {
      continue;
    }

    const annualRate = Number(vehicle.depreciation_rate);
    const monthlyRate = annualRate / 12 / 100;
    const currentValue = Number(vehicle.value);
    const newValue = Math.round(currentValue * (1 - monthlyRate) * 100) / 100;

    if (newValue < currentValue) {
      const updateResult = await pool.query(
        `UPDATE assets
         SET value = $1, last_auto_updated = NOW(), updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [newValue, vehicle.id, userId]
      );

      await pool.query(
        `INSERT INTO asset_history (asset_id, user_id, old_value, new_value, change_reason)
         VALUES ($1, $2, $3, $4, 'depreciation')`,
        [vehicle.id, userId, currentValue, newValue]
      );

      depreciated.push(updateResult.rows[0]);
    }
  }

  return depreciated;
}

/**
 * reduceLiabilityFromRepayment(userId, transactionName, amount)
 * Called automatically when a new transaction is added.
 * Checks if the transaction name matches a liability name (case-insensitive, partial match).
 * If a match is found, reduces that liability's value by Math.abs(amount).
 * Minimum value is 0 (never goes negative).
 * Logs to asset_history with change_reason: 'transaction_sync'.
 * Returns the updated liability or null if no match.
 */
async function reduceLiabilityFromRepayment(userId, transactionName, amount) {
  const repaymentAmount = Math.abs(Number(amount));

  // Keywords commonly used for liability repayments
  const repaymentKeywords = [
    'loan repayment', 'bond repayment', 'vehicle finance',
    'credit card payment', 'flexi credit', 'loan', 'bond',
    'credit card', 'finance', 'repayment'
  ];

  // Check if transaction name contains any repayment keyword
  const lowerName = transactionName.toLowerCase();
  const isRepayment = repaymentKeywords.some(keyword => lowerName.includes(keyword));

  if (!isRepayment && repaymentAmount <= 0) return null;

  // Find matching liabilities (case-insensitive)
  const liabilities = await pool.query(
    `SELECT * FROM assets
     WHERE user_id = $1 AND type = 'liability'
     ORDER BY name`,
    [userId]
  );

  let bestMatch = null;
  let bestScore = 0;

  for (const liability of liabilities.rows) {
    const lowerLiability = liability.name.toLowerCase();
    // Check for partial match of transaction name in liability name or vice versa
    if (lowerName.includes(lowerLiability) || lowerLiability.includes(lowerName)) {
      const score = Math.max(
        lowerName.includes(lowerLiability) ? lowerLiability.length : 0,
        lowerLiability.includes(lowerName) ? lowerName.length : 0
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = liability;
      }
    }
  }

  if (!bestMatch) return null;

  const currentValue = Number(bestMatch.value);
  const newValue = Math.max(0, currentValue - repaymentAmount);

  if (newValue === currentValue) return bestMatch;

  const updateResult = await pool.query(
    `UPDATE assets
     SET value = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [newValue, bestMatch.id, userId]
  );

  await pool.query(
    `INSERT INTO asset_history (asset_id, user_id, old_value, new_value, change_reason)
     VALUES ($1, $2, $3, $4, 'transaction_sync')`,
    [bestMatch.id, userId, currentValue, newValue]
  );

  return updateResult.rows[0];
}

/**
 * getNetworthHistory(userId, months)
 * Returns the last N months of snapshots from networth_snapshots.
 * If fewer than N snapshots exist, pads with calculated estimates
 * based on available data.
 * Returns array: [{ date, net_worth, total_assets, total_liabilities }]
 */
async function getNetworthHistory(userId, months = 12) {
  const result = await pool.query(
    `SELECT * FROM networth_snapshots
     WHERE user_id = $1
     ORDER BY snapshot_date DESC
     LIMIT $2`,
    [userId, months]
  );

  const snapshots = result.rows.map(row => ({
    date: row.snapshot_date,
    net_worth: Number(row.net_worth),
    total_assets: Number(row.total_assets),
    total_liabilities: Number(row.total_liabilities),
  }));

  // If we have enough snapshots, return them
  if (snapshots.length >= months) {
    return snapshots.reverse();
  }

  // Pad with calculated estimates based on current data
  const { totalAssets, totalLiabilities, netWorth } = await getUserTotals(userId);
  const currentSnapshot = {
    date: new Date().toISOString().split('T')[0],
    net_worth: netWorth,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
  };

  // Build the full array going backwards
  const padded = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Check if we have a snapshot for this date
    const existing = snapshots.find(s => s.date && s.date.substring(0, 7) === dateStr.substring(0, 7));
    if (existing) {
      padded.push(existing);
    } else {
      // Use current data with slight estimation for past months
      padded.push({
        date: dateStr,
        net_worth: currentSnapshot.net_worth,
        total_assets: currentSnapshot.total_assets,
        total_liabilities: currentSnapshot.total_liabilities,
      });
    }
  }

  return padded;
}

/**
 * getNetworthInsights(userId)
 * Compares current net worth to last month's snapshot.
 * Returns insights object with trend, projections, etc.
 */
async function getNetworthInsights(userId) {
  const { items, totalAssets, totalLiabilities, netWorth } = await getUserTotals(userId);

  // Get last month's snapshot
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().split('T')[0];

  const lastSnapshot = await pool.query(
    `SELECT * FROM networth_snapshots
     WHERE user_id = $1 AND snapshot_date <= $2
     ORDER BY snapshot_date DESC
     LIMIT 1`,
    [userId, lastMonthStr]
  );

  const lastMonthNetWorth = lastSnapshot.rows.length > 0
    ? Number(lastSnapshot.rows[0].net_worth)
    : netWorth;

  const change = netWorth - lastMonthNetWorth;
  const changePercent = lastMonthNetWorth !== 0
    ? Math.round((change / Math.abs(lastMonthNetWorth)) * 10000) / 100
    : 0;

  let trend = 'flat';
  if (changePercent > 1) trend = 'up';
  else if (changePercent < -1) trend = 'down';

  // Biggest asset gain
  const assets = items.filter(a => a.type === 'asset');
  const assetHistory = [];

  for (const asset of assets) {
    const history = await pool.query(
      `SELECT * FROM asset_history
       WHERE asset_id = $1 AND user_id = $2
       ORDER BY changed_at DESC
       LIMIT 1`,
      [asset.id, userId]
    );
    if (history.rows.length > 0) {
      const oldVal = Number(history.rows[0].old_value);
      const newVal = Number(history.rows[0].new_value);
      assetHistory.push({
        name: asset.name,
        change: newVal - oldVal,
      });
    }
  }

  // Biggest liability reduction
  const liabilities = items.filter(a => a.type === 'liability');
  const liabilityHistory = [];

  for (const liability of liabilities) {
    const history = await pool.query(
      `SELECT * FROM asset_history
       WHERE asset_id = $1 AND user_id = $2
       ORDER BY changed_at DESC
       LIMIT 1`,
      [liability.id, userId]
    );
    if (history.rows.length > 0) {
      const oldVal = Number(history.rows[0].old_value);
      const newVal = Number(history.rows[0].new_value);
      liabilityHistory.push({
        name: liability.name,
        change: newVal - oldVal, // negative if reduced
      });
    }
  }

  // Get biggest asset gain (positive change)
  const biggestAssetGain = assetHistory.length > 0
    ? assetHistory.reduce((best, curr) => curr.change > best.change ? curr : best)
    : { name: 'N/A', change: 0 };

  // Get biggest liability reduction (most negative change = biggest reduction)
  const biggestLiabilityReduction = liabilityHistory.length > 0
    ? liabilityHistory.reduce((best, curr) => curr.change < best.change ? curr : best)
    : { name: 'N/A', change: 0 };

  // Projected net worth 12 months at current rate
  const monthlyChange = monthsBetween(lastMonthStr, new Date().toISOString().split('T')[0]) > 0
    ? change / monthsBetween(lastMonthStr, new Date().toISOString().split('T')[0])
    : 0;

  const projectedNetWorth12Months = netWorth + (monthlyChange * 12);

  return {
    currentNetWorth: netWorth,
    lastMonthNetWorth,
    change: Math.round(change * 100) / 100,
    changePercent,
    trend,
    biggestAssetGain,
    biggestLiabilityReduction,
    projectedNetWorth12Months: Math.round(projectedNetWorth12Months * 100) / 100,
  };
}

function monthsBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) || 1;
}

module.exports = {
  getNetWorthForUser,
  takeMonthlySnapshot,
  syncCashFromTransactions,
  applyVehicleDepreciation,
  reduceLiabilityFromRepayment,
  getNetworthHistory,
  getNetworthInsights,
};
