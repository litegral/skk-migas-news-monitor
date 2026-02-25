-- Migration 008: Drop unused search_queries table
--
-- The search_queries table and SearchQueryManager component are no longer used.
-- The app now exclusively uses the topics table for news fetching configuration.

DROP TABLE IF EXISTS search_queries;
