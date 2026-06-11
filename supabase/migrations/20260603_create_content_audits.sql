-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- https://supabase.com/dashboard/project/wlozjajbzxkejejqojco/sql/new
-- NOTE: Already applied 2026-06-03 — do not re-run

CREATE TABLE IF NOT EXISTS content_audits (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now(),
  title         text        NOT NULL,
  content_type  text,
  platforms     text[],
  duration_s    integer,
  file_url      text,
  drive_file_id text,
  aov           numeric,
  context       text,
  mode          text        NOT NULL DEFAULT 'pre-live',
  score         integer,
  decision      text,         -- green_light | amber | red | kill
  report        text,
  hook_type     text,
  status        text        NOT NULL DEFAULT 'completed'
);

ALTER TABLE content_audits ENABLE ROW LEVEL SECURITY;

-- Service role (used by API routes) bypasses RLS automatically.
-- This policy allows anon reads if you ever want to expose audits client-side.
CREATE POLICY "anon_read" ON content_audits
  FOR SELECT USING (true);

CREATE POLICY "service_write" ON content_audits
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS content_audits_created_at_idx
  ON content_audits (created_at DESC);
