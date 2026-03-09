-- Migration: Add 'Non-Drug' to type CHECK constraint
-- Date: 2026-01-16
-- Description: Updates the inventory_items table to allow 'Non-Drug' as a valid type

-- Drop the existing CHECK constraint
ALTER TABLE inventory_items 
DROP CONSTRAINT IF EXISTS inventory_items_type_check;

-- Add the new CHECK constraint with 'Non-Drug' included
ALTER TABLE inventory_items 
ADD CONSTRAINT inventory_items_type_check 
CHECK (type IN ('OPD', 'Eye/Ear/Nose/Inh', 'DDA', 'External', 'Injection', 'Syrup', 'Others', 'UOD', 'Non-Drug'));
