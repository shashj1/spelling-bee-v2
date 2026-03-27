-- Spelling Bee App Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Groups table (e.g. "PENS (TMA)")
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Word lists (one active per group per week)
CREATE TABLE word_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  words TEXT[] NOT NULL,
  sentences JSONB,          -- { "word": "funny sentence", ... }
  story TEXT,               -- silly story using all words
  audio_urls JSONB,         -- { "word_hello": "url", "sentence_hello": "url", ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  generated BOOLEAN DEFAULT FALSE
);

-- Practice logs
CREATE TABLE practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_list_id UUID NOT NULL REFERENCES word_lists(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  score INTEGER,
  total INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_word_lists_group_expires ON word_lists(group_id, expires_at DESC);
CREATE INDEX idx_practices_word_list ON practices(word_list_id);
CREATE INDEX idx_practices_group ON practices(group_id);

-- Enable Row Level Security (but allow all access via service role)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations via anon key (app handles auth via admin password)
CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on word_lists" ON word_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on practices" ON practices FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for cached audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true);
CREATE POLICY "Allow public read on audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio');
CREATE POLICY "Allow service insert on audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio');
