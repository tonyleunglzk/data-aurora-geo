CREATE TABLE `GeoPromptEngineVersionDraftSession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `articleText` LONGTEXT NOT NULL,
  `articleUrl` VARCHAR(2048) NOT NULL DEFAULT '',
  `notes` TEXT NOT NULL,
  `messages` JSON NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `ownerUserId` INTEGER NULL,
  `ownerName` VARCHAR(191) NOT NULL DEFAULT '',
  `suggestedName` VARCHAR(191) NOT NULL DEFAULT '',
  `suggestedDescription` TEXT NOT NULL,
  `suggestedRuleText` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GeoPromptEngineVersionDraftSession_status_updatedAt_idx`
  ON `GeoPromptEngineVersionDraftSession`(`status`, `updatedAt`);

CREATE INDEX `GeoPromptEngineVersionDraftSession_ownerUserId_updatedAt_idx`
  ON `GeoPromptEngineVersionDraftSession`(`ownerUserId`, `updatedAt`);
