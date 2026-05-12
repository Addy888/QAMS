-- ACPT (Agent / Customer / Process / Technology) qualitative notes.
-- These three columns store the supervisor's call observation notes and
-- are NEVER read by the scoring engine. Historical audits get NULL values,
-- which the API and UI display as "not filled".
ALTER TABLE `audits`
  ADD COLUMN `acpt_category` VARCHAR(24)  NULL AFTER `fatal_triggered`,
  ADD COLUMN `acpt_level2`   LONGTEXT     NULL AFTER `acpt_category`,
  ADD COLUMN `acpt_level3`   LONGTEXT     NULL AFTER `acpt_level2`;
