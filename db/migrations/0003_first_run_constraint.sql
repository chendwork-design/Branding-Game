-- A student has exactly one immutable first run per class, while replays may be repeated.
ALTER TABLE playthroughs DROP CONSTRAINT IF EXISTS playthroughs_student_identity_id_kind_key;
CREATE UNIQUE INDEX IF NOT EXISTS one_first_run_per_student ON playthroughs (student_identity_id) WHERE kind = 'first_run';
