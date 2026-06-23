const cron = require('node-cron');
const pool = require('../db');
const {
  takeMonthlySnapshot,
  applyVehicleDepreciation,
  syncCashFromTransactions,
} = require('./networthService');

/**
 * Get all user IDs from the database.
 */
async function getAllUserIds() {
  const result = await pool.query('SELECT id FROM users');
  return result.rows.map(row => row.id);
}

/**
 * Get active user IDs (users who logged in within the last 30 days).
 */
async function getActiveUserIds() {
  const result = await pool.query(
    `SELECT id FROM users
     WHERE created_at >= NOW() - INTERVAL '30 days'
        OR EXISTS (
          SELECT 1 FROM transactions WHERE user_id = users.id AND created_at >= NOW() - INTERVAL '30 days'
        )`
  );
  return result.rows.map(row => row.id);
}

// ─── Schedule: Monthly Snapshot — 1st of month at 00:05 ──────────────────
cron.schedule('5 0 1 * *', async () => {
  console.log('[Scheduler] Running monthly net worth snapshots...');
  try {
    const userIds = await getAllUserIds();
    for (const userId of userIds) {
      try {
        const snapshot = await takeMonthlySnapshot(userId);
        console.log(`[Scheduler] Snapshot taken for user ${userId}: R${snapshot.net_worth}`);
      } catch (err) {
        console.error(`[Scheduler] Error taking snapshot for user ${userId}:`, err.message);
      }
    }
    console.log(`[Scheduler] Monthly snapshots complete for ${userIds.length} users.`);
  } catch (err) {
    console.error('[Scheduler] Monthly snapshot error:', err.message);
  }
});

// ─── Schedule: Vehicle Depreciation — 1st of month at 00:10 ─────────────
cron.schedule('10 0 1 * *', async () => {
  console.log('[Scheduler] Applying vehicle depreciation...');
  try {
    const userIds = await getAllUserIds();
    for (const userId of userIds) {
      try {
        const depreciated = await applyVehicleDepreciation(userId);
        if (depreciated.length > 0) {
          console.log(`[Scheduler] Depreciated ${depreciated.length} vehicles for user ${userId}`);
        }
      } catch (err) {
        console.error(`[Scheduler] Error applying depreciation for user ${userId}:`, err.message);
      }
    }
    console.log(`[Scheduler] Vehicle depreciation complete for ${userIds.length} users.`);
  } catch (err) {
    console.error('[Scheduler] Vehicle depreciation error:', err.message);
  }
});

// ─── Schedule: Daily Sync — every day at 23:55 ──────────────────────────
cron.schedule('55 23 * * *', async () => {
  console.log('[Scheduler] Running daily transaction sync...');
  try {
    const userIds = await getActiveUserIds();
    for (const userId of userIds) {
      try {
        const updated = await syncCashFromTransactions(userId);
        if (updated.length > 0) {
          console.log(`[Scheduler] Synced ${updated.length} linked assets for user ${userId}`);
        }
      } catch (err) {
        console.error(`[Scheduler] Error syncing transactions for user ${userId}:`, err.message);
      }
    }
    console.log(`[Scheduler] Daily sync complete for ${userIds.length} active users.`);
  } catch (err) {
    console.error('[Scheduler] Daily sync error:', err.message);
  }
});

console.log('[Scheduler] Net worth automation scheduler started.');