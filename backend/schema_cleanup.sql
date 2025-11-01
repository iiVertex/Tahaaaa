-- Cleanup script to remove duplicate sections from schema.sql
-- Run this AFTER executing the main schema.sql to remove any duplicate objects

-- Drop duplicate materialized views if they exist (should already exist from main schema)
DROP MATERIALIZED VIEW IF EXISTS user_engagement_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_mission_stats CASCADE;

-- Note: The main schema.sql file has been cleaned up
-- All duplicates have been removed
-- All RLS policies now use COALESCE(current_user_uuid(), auth.uid()) for Clerk compatibility

