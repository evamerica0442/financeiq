-- FinanceIQ Database Schema
-- Run this in the Neon SQL editor to create all tables

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#8B92A5',
  sort_order INTEGER DEFAULT 0,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove the UNIQUE constraint on name only; we'll enforce per-user uniqueness at application level
-- or use a partial unique index later
DROP INDEX IF EXISTS category_groups_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_groups_name_user ON category_groups(name, COALESCE(user_id, 0));

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  group_id INTEGER REFERENCES category_groups(id) ON DELETE CASCADE,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#8B92A5',
  sort_order INTEGER DEFAULT 0,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'expense' CHECK (type IN ('expense', 'income', 'transfer')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user unique category names
DROP INDEX IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_user ON categories(name, COALESCE(user_id, 0));

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,  -- negative = expense, positive = income
  category TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_future BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(12,2) NOT NULL,
  UNIQUE(user_id, category)
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  saved_amount NUMERIC(12,2) DEFAULT 0,
  monthly_contribution NUMERIC(12,2) DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  type TEXT DEFAULT 'asset',  -- 'asset' or 'liability'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default category groups (global, user_id = null)
INSERT INTO category_groups (name, icon, color, sort_order, user_id) VALUES
  ('Essential Living', '🏠', '#4D9FFF', 1, NULL),
  ('Food & Dining', '🍽️', '#00C896', 2, NULL),
  ('Transport', '🚗', '#FFAB2E', 3, NULL),
  ('Health & Insurance', '💊', '#FF5C5C', 4, NULL),
  ('Entertainment', '🎬', '#F7AEF8', 5, NULL),
  ('Subscriptions', '📱', '#FF8ED4', 6, NULL),
  ('Housing & Utilities', '💡', '#9B7FFF', 7, NULL),
  ('Education', '📚', '#74B9FF', 8, NULL),
  ('Savings & Investments', '💰', '#00C896', 9, NULL),
  ('Income', '💵', '#00C896', 10, NULL),
  ('Other', '📦', '#8B92A5', 11, NULL)
ON CONFLICT (name, COALESCE(user_id, 0)) DO NOTHING;

-- Seed default categories with their groups (global, user_id = null)
INSERT INTO categories (name, group_id, icon, color, sort_order, type, user_id, is_active)
SELECT 'Housing', id, '🏠', '#4D9FFF', 1, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Essential Living' AND user_id IS NULL
UNION ALL SELECT 'Groceries', id, '🛒', '#00C896', 2, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Food & Dining' AND user_id IS NULL
UNION ALL SELECT 'Dining out', id, '🍽️', '#FF6B6B', 3, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Food & Dining' AND user_id IS NULL
UNION ALL SELECT 'Transport', id, '🚗', '#FFAB2E', 4, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Transport' AND user_id IS NULL
UNION ALL SELECT 'Fuel', id, '⛽', '#FF8A2E', 5, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Transport' AND user_id IS NULL
UNION ALL SELECT 'Health', id, '💊', '#FF5C5C', 6, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Health & Insurance' AND user_id IS NULL
UNION ALL SELECT 'Medical Aid', id, '🏥', '#E74C3C', 7, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Health & Insurance' AND user_id IS NULL
UNION ALL SELECT 'Insurance', id, '🛡️', '#C0392B', 8, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Health & Insurance' AND user_id IS NULL
UNION ALL SELECT 'Entertainment', id, '🎬', '#F7AEF8', 9, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Entertainment' AND user_id IS NULL
UNION ALL SELECT 'Subscriptions', id, '📱', '#FF8ED4', 10, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Subscriptions' AND user_id IS NULL
UNION ALL SELECT 'Utilities', id, '💡', '#9B7FFF', 11, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Housing & Utilities' AND user_id IS NULL
UNION ALL SELECT 'Rent', id, '🏢', '#8E44AD', 12, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Housing & Utilities' AND user_id IS NULL
UNION ALL SELECT 'Education', id, '📚', '#74B9FF', 13, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Education' AND user_id IS NULL
UNION ALL SELECT 'Savings', id, '💰', '#00C896', 14, 'transfer', NULL, TRUE FROM category_groups WHERE name = 'Savings & Investments' AND user_id IS NULL
UNION ALL SELECT 'Investments', id, '📈', '#1ABC9C', 15, 'transfer', NULL, TRUE FROM category_groups WHERE name = 'Savings & Investments' AND user_id IS NULL
UNION ALL SELECT 'Income', id, '💵', '#00C896', 16, 'income', NULL, TRUE FROM category_groups WHERE name = 'Income' AND user_id IS NULL
UNION ALL SELECT 'Other', id, '📦', '#8B92A5', 17, 'expense', NULL, TRUE FROM category_groups WHERE name = 'Other' AND user_id IS NULL
ON CONFLICT (name, COALESCE(user_id, 0)) DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_is_future ON transactions(is_future);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_group_id ON categories(group_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_category_groups_user_id ON category_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);