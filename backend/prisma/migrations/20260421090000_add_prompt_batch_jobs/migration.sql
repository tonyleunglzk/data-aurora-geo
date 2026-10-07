CREATE TABLE `GeoPromptBatchCounter` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `profileId` INTEGER NOT NULL,
  `lastSequence` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GeoPromptBatchCounter_profileId_key`(`profileId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPromptBatchJob` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `engineType` ENUM('LEGACY', 'V2') NOT NULL,
  `profileId` INTEGER NOT NULL,
  `profileName` VARCHAR(191) NOT NULL,
  `versionId` INTEGER NULL,
  `versionName` VARCHAR(191) NOT NULL DEFAULT '',
  `versionDescription` TEXT NOT NULL,
  `versionRuleText` TEXT NOT NULL,
  `fixedRulesText` TEXT NOT NULL,
  `articleUrl` VARCHAR(2048) NOT NULL DEFAULT '',
  `articleText` LONGTEXT NOT NULL,
  `productSnapshot` JSON NOT NULL,
  `ruleCardSnapshot` JSON NULL,
  `requestedCount` INTEGER NOT NULL,
  `successCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `queuedCount` INTEGER NOT NULL DEFAULT 0,
  `runningCount` INTEGER NOT NULL DEFAULT 0,
  `dateCode` VARCHAR(191) NOT NULL,
  `sequenceStart` INTEGER NULL,
  `sequenceEnd` INTEGER NULL,
  `zipFileName` VARCHAR(191) NOT NULL DEFAULT '',
  `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `lastError` TEXT NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPromptBatchJobItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `jobId` INTEGER NOT NULL,
  `itemIndex` INTEGER NOT NULL,
  `status` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `sequence` INTEGER NULL,
  `fileName` VARCHAR(191) NOT NULL DEFAULT '',
  `promptText` LONGTEXT NOT NULL,
  `rawOutput` LONGTEXT NOT NULL,
  `errorMessage` TEXT NOT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GeoPromptBatchJobItem_jobId_itemIndex_key`(`jobId`, `itemIndex`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GeoPromptBatchJob_status_updatedAt_idx`
  ON `GeoPromptBatchJob`(`status`, `updatedAt`);

CREATE INDEX `GeoPromptBatchJob_profileId_createdAt_idx`
  ON `GeoPromptBatchJob`(`profileId`, `createdAt`);

CREATE INDEX `GeoPromptBatchJob_engineType_createdAt_idx`
  ON `GeoPromptBatchJob`(`engineType`, `createdAt`);

CREATE INDEX `GeoPromptBatchJobItem_jobId_itemIndex_idx`
  ON `GeoPromptBatchJobItem`(`jobId`, `itemIndex`);

CREATE INDEX `GeoPromptBatchJobItem_status_updatedAt_idx`
  ON `GeoPromptBatchJobItem`(`status`, `updatedAt`);

ALTER TABLE `GeoPromptBatchCounter`
  ADD CONSTRAINT `GeoPromptBatchCounter_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `GeoProductProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GeoPromptBatchJob`
  ADD CONSTRAINT `GeoPromptBatchJob_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `GeoProductProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GeoPromptBatchJobItem`
  ADD CONSTRAINT `GeoPromptBatchJobItem_jobId_fkey`
  FOREIGN KEY (`jobId`) REFERENCES `GeoPromptBatchJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
