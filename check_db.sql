-- Check if units exist and their active status
SELECT COUNT(*) as total_units, 
       SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_units,
       SUM(CASE WHEN active = false THEN 1 ELSE 0 END) as inactive_units
FROM units;

-- Show a sample of units
SELECT unit_code, unit_name, active, scraped_at 
FROM units 
LIMIT 10;
