-- M9: store version metadata separately so existing v1.0 playthrough rows are not rewritten.
CREATE TABLE IF NOT EXISTS playthrough_protocols (
  playthrough_id uuid PRIMARY KEY REFERENCES playthroughs(id) ON DELETE CASCADE,
  protocol_version text NOT NULL CHECK (protocol_version IN ('1.0', '1.1')),
  engine_version text NOT NULL,
  report_version text NOT NULL,
  content_version text NOT NULL,
  content_checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id)
);

CREATE INDEX IF NOT EXISTS idx_playthrough_protocols_content
  ON playthrough_protocols(content_version, engine_version, report_version);
