-- V11 formal storage contract. This migration only adds constraints and metadata;
-- it never rewrites or removes historical playthrough rows.
ALTER TABLE decision_logs ADD COLUMN IF NOT EXISTS action_hash text;

ALTER TABLE playthrough_protocols
  DROP CONSTRAINT IF EXISTS playthrough_protocols_protocol_version_check;
ALTER TABLE playthrough_protocols
  ADD CONSTRAINT playthrough_protocols_protocol_version_check
  CHECK (protocol_version IN ('1.0', '1.1', '1.2'));

CREATE UNIQUE INDEX IF NOT EXISTS decision_logs_playthrough_action_id_idx
  ON decision_logs (playthrough_id, ((action_json ->> 'actionId')));

CREATE INDEX IF NOT EXISTS idx_decision_logs_idempotency
  ON decision_logs(playthrough_id, idempotency_key);
