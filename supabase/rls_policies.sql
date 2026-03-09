-- PIMS Row Level Security Policies
-- Public read/write access for all users (no authentication required)

-- Enable RLS on tables
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE indent_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read access for inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Public write access for inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Public read access for indent_requests" ON indent_requests;
DROP POLICY IF EXISTS "Public write access for indent_requests" ON indent_requests;

-- inventory_items: Public read/write access
CREATE POLICY "Public read access for inventory_items"
  ON inventory_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public write access for inventory_items"
  ON inventory_items
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- indent_requests: Public read/write access
CREATE POLICY "Public read access for indent_requests"
  ON indent_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public write access for indent_requests"
  ON indent_requests
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
