-- Monthly net worth snapshots (auto-saved on the 1st of each month)
CREATE TABLE IF NOT EXISTS networth_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_assets NUMERIC(14,2) NOT NULL,
  total_liabilities NUMERIC(14,2) NOT NULL,
  net_worth NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- Asset/liability change history log
CREATE TABLE IF NOT EXISTS asset_history (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  old_value NUMERIC(14,2),
  new_value NUMERIC(14,2),
  change_reason TEXT, -- 'manual', 'depreciation', 'transaction_sync', 'snapshot'
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add extra columns to the existing assets table if they don't exist
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'other';
-- asset_type values: 'cash', 'savings', 'investment', 'property', 'vehicle', 'other'
-- liability_type values (stored in same table, type='liability'): 'home_loan', 'vehicle_finance', 'personal_loan', 'credit_card', 'store_account', 'other'

ALTER TABLE assets ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(5,2) DEFAULT 0;
-- Annual depreciation % — e.g. 15 means 15% per year. Only used when asset_type = 'vehicle'

ALTER TABLE assets ADD COLUMN IF NOT EXISTS linked_category TEXT DEFAULT NULL;
-- e.g. 'Savings' — if set, this asset's value auto-syncs with transactions in this category

ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_auto_updated TIMESTAMPTZ DEFAULT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_networth_snapshots_user_id ON networth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_networth_snapshots_date ON networth_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_user_id ON asset_history(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_reason ON asset_history(change_reason);