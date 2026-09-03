-- Append-only gameplay projections. The decision log remains the audit source;
-- these tables make the main teaching objects queryable without rewriting history.

CREATE TABLE IF NOT EXISTS evidence_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  evidence_id text NOT NULL,
  cost integer NOT NULL CHECK (cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, evidence_id),
  UNIQUE (playthrough_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS visual_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  visual_id text NOT NULL,
  revision_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  event_id text NOT NULL,
  class_wide boolean NOT NULL,
  trace_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, event_id),
  UNIQUE (playthrough_id, sequence_no, event_id)
);

CREATE TABLE IF NOT EXISTS state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  state_json jsonb NOT NULL,
  state_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, sequence_no),
  UNIQUE (playthrough_id, state_hash)
);

CREATE TABLE IF NOT EXISTS endings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  ending_id text NOT NULL,
  state_hash text NOT NULL,
  ending_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  state_hash text NOT NULL,
  report_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id)
);

CREATE TABLE IF NOT EXISTS reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, revision)
);

CREATE TABLE IF NOT EXISTS sync_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  sequence_no integer,
  status text NOT NULL CHECK (status IN ('accepted', 'duplicate', 'rejected', 'conflict')),
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_evidence_views_playthrough ON evidence_views(playthrough_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_visual_choices_playthrough ON visual_choices(playthrough_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_game_events_playthrough ON game_events(playthrough_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_state_snapshots_playthrough ON state_snapshots(playthrough_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_sync_receipts_playthrough ON sync_receipts(playthrough_id, sequence_no);
