-- Scoring correction: track applicable points (YES + NO denominator) separately
-- from earned points so N/A answers can be excluded from the score percentage.
--
-- totalScore       = sum of weights for passing (YES) questions  [unchanged meaning]
-- applicable_points = sum of weights for YES + NO questions      [new column]
-- finalScore       = (totalScore / applicable_points) * 100, or 0 if fatal [meaning updated]
--
-- Historical rows keep their existing totalScore / finalScore values and will
-- have applicable_points = NULL, which the API and UI treat as legacy format.
ALTER TABLE `audits`
  ADD COLUMN `applicable_points` DOUBLE NULL AFTER `total_score`;
