-- Add soft-delete columns to the audits table.
-- Supervisors can "discard" DRAFT / IN_PROGRESS audits so they stop
-- appearing in active workflow lists. We never hard-delete audit rows
-- because the immutable lifecycle promise extends back to drafts in
-- progress, and historical audit trails need to remain queryable.
ALTER TABLE `audits`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `deleted_by` VARCHAR(191) NULL;

CREATE INDEX `audits_deleted_at_idx` ON `audits`(`deleted_at`);
