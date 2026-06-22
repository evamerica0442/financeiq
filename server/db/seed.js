require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./index');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Create demo user
    const password_hash = await bcrypt.hash('demo1234', 12);
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, currency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Demo User', 'demo@financeiq.app', password_hash, 'ZAR']
    );
    const userId = userResult.rows[0].id;
    console.log(`Demo user created with ID: ${userId}`);

    // Clear existing demo data
    await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM budgets WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM goals WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM assets WHERE user_id = $1', [userId]);

    // Seed transactions (last 6 months)
    const categories = ['Housing', 'Groceries', 'Transport', 'Dining out', 'Utilities', 'Subscriptions', 'Health', 'Entertainment', 'Education', 'Savings', 'Income', 'Other'];
    const transactions = [];
    const now = new Date();

    // Monthly income
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      transactions.push({
        name: 'Salary',
        amount: 45000,
        category: 'Income',
        date: d.toISOString().split('T')[0],
        notes: 'Monthly salary'
      });
    }

    // Recurring expenses each month
    const expensePatterns = [
      { name: 'Rent', amount: -8500, category: 'Housing' },
      { name: 'Pick n Pay Groceries', amount: -3200, category: 'Groceries' },
      { name: 'Woolworths Groceries', amount: -1800, category: 'Groceries' },
      { name: 'Uber Rides', amount: -650, category: 'Transport' },
      { name: 'Fuel', amount: -1200, category: 'Transport' },
      { name: 'Netflix', amount: -199, category: 'Subscriptions' },
      { name: 'Spotify', amount: -89, category: 'Subscriptions' },
      { name: 'Eskom Electricity', amount: -950, category: 'Utilities' },
      { name: 'Water & Rates', amount: -450, category: 'Utilities' },
      { name: 'Medical Aid', amount: -2400, category: 'Health' },
      { name: 'Discovery Insurance', amount: -850, category: 'Health' },
      { name: 'DStv', amount: -699, category: 'Entertainment' },
      { name: 'Restaurant Dinner', amount: -420, category: 'Dining out' },
      { name: 'Takeaway Lunch', amount: -150, category: 'Dining out' }
    ];

    for (let i = 5; i >= 0; i--) {
      for (const pattern of expensePatterns) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, Math.floor(Math.random() * 28) + 1);
        // Add some variation to amounts
        const variation = 1 + (Math.random() - 0.5) * 0.2;
        transactions.push({
          name: pattern.name,
          amount: Math.round(pattern.amount * variation),
          category: pattern.category,
          date: d.toISOString().split('T')[0],
          notes: null
        });
      }
    }

    // Insert transactions
    for (const t of transactions) {
      await client.query(
        'INSERT INTO transactions (user_id, name, amount, category, date, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, t.name, t.amount, t.category, t.date, t.notes]
      );
    }
    console.log(`Inserted ${transactions.length} transactions`);

    // Seed budgets
    const budgets = [
      { category: 'Groceries', monthly_limit: 6000 },
      { category: 'Transport', monthly_limit: 2500 },
      { category: 'Dining out', monthly_limit: 2000 },
      { category: 'Entertainment', monthly_limit: 1500 },
      { category: 'Utilities', monthly_limit: 2000 },
      { category: 'Subscriptions', monthly_limit: 1500 }
    ];

    for (const b of budgets) {
      await client.query(
        'INSERT INTO budgets (user_id, category, monthly_limit) VALUES ($1, $2, $3) ON CONFLICT (user_id, category) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit',
        [userId, b.category, b.monthly_limit]
      );
    }
    console.log('Budgets seeded');

    // Seed goals
    const goals = [
      { name: 'Emergency Fund', target_amount: 60000, saved_amount: 25000, monthly_contribution: 5000 },
      { name: 'New Car', target_amount: 350000, saved_amount: 45000, monthly_contribution: 8000 },
      { name: 'Europe Holiday', target_amount: 80000, saved_amount: 15000, monthly_contribution: 3000, target_date: '2027-06-01' }
    ];

    for (const g of goals) {
      await client.query(
        `INSERT INTO goals (user_id, name, target_amount, saved_amount, monthly_contribution, target_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, g.name, g.target_amount, g.saved_amount, g.monthly_contribution, g.target_date || null]
      );
    }
    console.log('Goals seeded');

    // Seed assets & liabilities
    const assets = [
      { name: 'Chequing Account', value: 35000, type: 'asset' },
      { name: 'Savings Account', value: 25000, type: 'asset' },
      { name: 'TFSA Investment', value: 45000, type: 'asset' },
      { name: 'Car Value', value: 180000, type: 'asset' },
      { name: 'Property Value', value: 1500000, type: 'asset' },
      { name: 'Car Loan', value: -120000, type: 'liability' },
      { name: 'Credit Card', value: -8500, type: 'liability' },
      { name: 'Student Loan', value: -95000, type: 'liability' }
    ];

    for (const a of assets) {
      await client.query(
        'INSERT INTO assets (user_id, name, value, type) VALUES ($1, $2, $3, $4)',
        [userId, a.name, a.value, a.type]
      );
    }
    console.log('Assets and liabilities seeded');

    console.log('\n✅ Seed complete!');
    console.log('   Login: demo@financeiq.app');
    console.log('   Password: demo1234');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();