-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `dueReminderSentAt` DATETIME(3) NULL,
    ADD COLUMN `overdueNoticeSentAt` DATETIME(3) NULL;

