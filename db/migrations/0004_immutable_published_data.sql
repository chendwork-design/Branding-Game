CREATE OR REPLACE FUNCTION prevent_class_rule_mutation() RETURNS trigger AS $$
BEGIN
  IF NEW.content_version_id IS DISTINCT FROM OLD.content_version_id OR NEW.seed_ciphertext IS DISTINCT FROM OLD.seed_ciphertext THEN
    RAISE EXCEPTION 'published class content version and seed are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classes_rule_immutable ON classes;
CREATE TRIGGER classes_rule_immutable BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION prevent_class_rule_mutation();

CREATE OR REPLACE FUNCTION prevent_published_content_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' AND (NEW.version IS DISTINCT FROM OLD.version OR NEW.engine_version IS DISTINCT FROM OLD.engine_version OR NEW.checksum IS DISTINCT FROM OLD.checksum OR NEW.content_json IS DISTINCT FROM OLD.content_json) THEN
    RAISE EXCEPTION 'published content version is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS published_content_immutable ON content_versions;
CREATE TRIGGER published_content_immutable BEFORE UPDATE ON content_versions FOR EACH ROW EXECUTE FUNCTION prevent_published_content_mutation();
