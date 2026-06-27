-- Journal entries table for the personal financial journal feature
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  mood TEXT DEFAULT NULL, -- 'great', 'good', 'neutral', 'stressed', 'worried'
  tags TEXT[] DEFAULT '{}', -- e.g. {'savings', 'debt', 'goals', 'spending'}
  ai_insight TEXT DEFAULT NULL, -- cached AI insight for this entry
  ai_insight_generated_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups ordered by date
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, created_at DESC);
