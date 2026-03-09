-- Update 'OPD Counter' to 'OPD Kaunter'
UPDATE inventory_items
SET indent_source = 'OPD Kaunter'
WHERE indent_source = 'OPD Counter';

-- Update 'OPD Substore' to 'OPD Substor'
UPDATE inventory_items
SET indent_source = 'OPD Substor'
WHERE indent_source = 'OPD Substore';

-- Update 'IPD Counter' to 'IPD Kaunter'
UPDATE inventory_items
SET indent_source = 'IPD Kaunter'
WHERE indent_source = 'IPD Counter';

-- Update 'IPD Substore' to 'IPD Substor'
UPDATE inventory_items
SET indent_source = 'IPD Substor'
WHERE indent_source = 'IPD Substore';

-- Update 'Manufact' to 'MNF Eksternal'
-- NOTE: If some 'Manufact' items should be 'MNF Internal', you will need to update them manually or adjust the WHERE clause.
UPDATE inventory_items
SET indent_source = 'MNF Eksternal'
WHERE indent_source = 'Manufact';

-- New Categories: 'MNF Internal' and 'HPSF Muar'
-- Since these are new categories, there are likely no existing items to migrate.
-- However, if you wish to move items to these categories, you can use queries like below:

-- Example: Move specific items to 'MNF Internal'
-- UPDATE inventory_items SET indent_source = 'MNF Internal' WHERE indent_source = 'SOME_OLD_VALUE';

-- Example: Move specific items to 'HPSF Muar'
-- UPDATE inventory_items SET indent_source = 'HPSF Muar' WHERE indent_source = 'SOME_OLD_VALUE';
