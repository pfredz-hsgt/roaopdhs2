-- PIMS Database Schema
-- Emergency Pharmacy Hospital Segamat

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: inventory_items
-- Master list of all drugs in the pharmacy
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  item_code TEXT,
  pku TEXT,
  puchase_type TEXT CHECK (puchase_type IN ('LP', 'APPL')),
  std_kt TEXT CHECK (std_kt IN ('STD', 'KT')),
  row TEXT,
  max_qty INTEGER,
  balance INTEGER,
  indent_source TEXT CHECK (indent_source IN ('OPD Kaunter', 'OPD Substor', 'IPD Kaunter', 'MNF Substor', 'MNF Eksternal', 'MNF Internal', 'Prepacking', 'IPD Substor', 'HPSF Muar')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: indent_requests
-- Stores cart items and finalized orders
CREATE TABLE IF NOT EXISTS indent_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  requested_qty TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_indent_source ON inventory_items(indent_source);
CREATE INDEX IF NOT EXISTS idx_indent_requests_status ON indent_requests(status);
CREATE INDEX IF NOT EXISTS idx_indent_requests_item_id ON indent_requests(item_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_indent_requests_updated_at
  BEFORE UPDATE ON indent_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add Short Expiry Columns (Added by Migration)
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS is_short_exp BOOLEAN DEFAULT false;

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS short_exp DATE;
