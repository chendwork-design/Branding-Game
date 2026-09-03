CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  engine_version text NOT NULL,
  checksum text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'reviewed', 'published', 'retired')),
  content_json jsonb NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  content_version_id uuid NOT NULL REFERENCES content_versions(id),
  seed_ciphertext text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'closed', 'archived')) DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS student_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_number text NOT NULL,
  normalized_student_number text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, normalized_student_number)
);

CREATE TABLE IF NOT EXISTS student_sessions (
  token_hash text PRIMARY KEY,
  student_identity_id uuid NOT NULL REFERENCES student_identities(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playthroughs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_identity_id uuid NOT NULL REFERENCES student_identities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('first_run', 'replay')),
  status text NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  state_json jsonb NOT NULL,
  state_hash text NOT NULL,
  report_json jsonb,
  reflection_json jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (student_identity_id, kind) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id uuid NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  idempotency_key text NOT NULL,
  action_json jsonb NOT NULL,
  trace_json jsonb NOT NULL,
  state_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, sequence_no),
  UNIQUE (playthrough_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  playthrough_id uuid REFERENCES playthroughs(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  sequence_no integer,
  payload_json jsonb NOT NULL,
  server_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_identities_class ON student_identities(class_id);
CREATE INDEX IF NOT EXISTS idx_playthroughs_class ON playthroughs(class_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_playthrough ON decision_logs(playthrough_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_analytics_events_class ON analytics_events(class_id, event_name);
