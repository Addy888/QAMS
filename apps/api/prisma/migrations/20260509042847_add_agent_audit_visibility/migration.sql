-- AlterTable
ALTER TABLE `audits` ADD COLUMN `acknowledged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `published_at` DATETIME(3) NULL,
    ADD COLUMN `published_by` VARCHAR(191) NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'PUBLISHED', 'REVIEWED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX `audits_published_at_idx` ON `audits`(`published_at`);

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_published_by_fkey` FOREIGN KEY (`published_by`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
