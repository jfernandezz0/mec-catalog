-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS) on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create strict RLS Policy for audit_logs (Admin only)
DROP POLICY IF EXISTS "Allow read for admin only" ON audit_logs;
CREATE POLICY "Allow read for admin only" ON audit_logs
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'minienginescreations@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'minienginescreations@gmail.com');

-- 4. Create the triggers function to capture admin modifications
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_old JSONB := NULL;
  v_new JSONB := NULL;
  v_record_id TEXT;
BEGIN
  -- Retrieve user info from JWT if executed through Supabase Auth/PostgREST
  v_user_id := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

  -- If it's a delete, get the old data
  IF (TG_OP = 'DELETE') THEN
    v_old := to_jsonb(OLD);
    v_record_id := CAST(OLD.id AS TEXT);
  -- If it's an insert or update, get the new data
  ELSIF (TG_OP = 'INSERT') THEN
    v_new := to_jsonb(NEW);
    v_record_id := CAST(NEW.id AS TEXT);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := CAST(NEW.id AS TEXT);
  END IF;

  -- For settings, since key is primary key instead of id, handle it
  IF (TG_TABLE_NAME = 'settings') THEN
    IF (TG_OP = 'DELETE') THEN
      v_record_id := OLD.key;
    ELSE
      v_record_id := NEW.key;
    END IF;
  END IF;

  -- Insert the audit log entry
  INSERT INTO audit_logs (
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_user_id,
    v_user_email,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the audit triggers to admin tables
-- Articles trigger
DROP TRIGGER IF EXISTS audit_articles_trigger ON articles;
CREATE TRIGGER audit_articles_trigger
AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Categories trigger
DROP TRIGGER IF EXISTS audit_categories_trigger ON categories;
CREATE TRIGGER audit_categories_trigger
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Settings trigger
DROP TRIGGER IF EXISTS audit_settings_trigger ON settings;
CREATE TRIGGER audit_settings_trigger
AFTER INSERT OR UPDATE OR DELETE ON settings
FOR EACH ROW EXECUTE FUNCTION process_audit_log();
