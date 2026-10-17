-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `inviteTokenHash` CHAR(64) NULL,
    ADD COLUMN `invitedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Tenant_inviteTokenHash_key` ON `Tenant`(`inviteTokenHash`);

