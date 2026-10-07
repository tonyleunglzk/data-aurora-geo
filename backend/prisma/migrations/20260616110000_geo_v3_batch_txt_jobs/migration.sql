ALTER TABLE `GeoPromptV3VersionDraftSession`
  ADD COLUMN `sourceType` VARCHAR(191) NOT NULL DEFAULT 'MANUAL_CHAT',
  ADD COLUMN `sourceBatchTxtJobId` INTEGER NULL,
  ADD COLUMN `sourceBatchTxtJobItemId` INTEGER NULL;

UPDATE `GeoPromptV3VersionDraftSession`
SET `sourceType` = 'V2_IMPORT'
WHERE `sourceV2SessionId` IS NOT NULL;

CREATE INDEX `GeoPromptV3VersionDraftSession_sourceType_updatedAt_idx`
  ON `GeoPromptV3VersionDraftSession`(`sourceType`, `updatedAt`);

CREATE INDEX `GeoPromptV3VersionDraftSession_sourceBatchTxtJobId_idx`
  ON `GeoPromptV3VersionDraftSession`(`sourceBatchTxtJobId`);

CREATE INDEX `GeoPromptV3VersionDraftSession_sourceBatchTxtJobItemId_idx`
  ON `GeoPromptV3VersionDraftSession`(`sourceBatchTxtJobItemId`);

CREATE TABLE `GeoPromptV3BatchTxtJob` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productCategory` VARCHAR(191) NOT NULL DEFAULT '',
  `requirements` JSON NOT NULL,
  `model` VARCHAR(191) NOT NULL DEFAULT '',
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `requestedCount` INTEGER NOT NULL DEFAULT 0,
  `successCount` INTEGER NOT NULL DEFAULT 0,
  `skippedCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `runningCount` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NOT NULL,
  `ownerUserId` INTEGER NULL,
  `ownerName` VARCHAR(191) NOT NULL DEFAULT '',
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GeoPromptV3BatchTxtJob_status_createdAt_idx`
  ON `GeoPromptV3BatchTxtJob`(`status`, `createdAt`);

CREATE INDEX `GeoPromptV3BatchTxtJob_ownerUserId_createdAt_idx`
  ON `GeoPromptV3BatchTxtJob`(`ownerUserId`, `createdAt`);

CREATE TABLE `GeoPromptV3BatchTxtJobItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `jobId` INTEGER NOT NULL,
  `itemIndex` INTEGER NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `versionName` VARCHAR(191) NOT NULL,
  `articleText` LONGTEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `errorMessage` TEXT NOT NULL,
  `versionId` INTEGER NULL,
  `variableSetId` INTEGER NULL,
  `draftSessionId` INTEGER NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `GeoPromptV3BatchTxtJobItem_jobId_itemIndex_key`
  ON `GeoPromptV3BatchTxtJobItem`(`jobId`, `itemIndex`);

CREATE INDEX `GeoPromptV3BatchTxtJobItem_jobId_status_idx`
  ON `GeoPromptV3BatchTxtJobItem`(`jobId`, `status`);

CREATE INDEX `GeoPromptV3BatchTxtJobItem_versionName_idx`
  ON `GeoPromptV3BatchTxtJobItem`(`versionName`);

CREATE INDEX `GeoPromptV3BatchTxtJobItem_versionId_idx`
  ON `GeoPromptV3BatchTxtJobItem`(`versionId`);

CREATE INDEX `GeoPromptV3BatchTxtJobItem_variableSetId_idx`
  ON `GeoPromptV3BatchTxtJobItem`(`variableSetId`);

CREATE INDEX `GeoPromptV3BatchTxtJobItem_draftSessionId_idx`
  ON `GeoPromptV3BatchTxtJobItem`(`draftSessionId`);

ALTER TABLE `GeoPromptV3BatchTxtJobItem`
  ADD CONSTRAINT `GeoPromptV3BatchTxtJobItem_jobId_fkey`
  FOREIGN KEY (`jobId`) REFERENCES `GeoPromptV3BatchTxtJob`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
