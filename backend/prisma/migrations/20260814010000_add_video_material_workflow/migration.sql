ALTER TABLE `VideoMaterialClip`
  ADD COLUMN `contentTopics` JSON NULL AFTER `contentType`,
  ADD COLUMN `actions` JSON NULL AFTER `tags`,
  ADD COLUMN `objects` JSON NULL AFTER `actions`,
  ADD COLUMN `scenes` JSON NULL AFTER `objects`,
  ADD COLUMN `brands` JSON NULL AFTER `scenes`,
  ADD COLUMN `qualityFlags` JSON NULL AFTER `brands`,
  ADD COLUMN `qualityScore` DOUBLE NULL AFTER `qualityFlags`,
  ADD COLUMN `usabilityScore` DOUBLE NULL AFTER `qualityScore`,
  ADD COLUMN `hasPerson` BOOLEAN NOT NULL DEFAULT false AFTER `usabilityScore`,
  ADD COLUMN `hasTextOverlay` BOOLEAN NOT NULL DEFAULT false AFTER `hasPerson`;

UPDATE `VideoMaterialClip`
SET
  `contentTopics` = JSON_ARRAY(`contentType`),
  `actions` = JSON_ARRAY(),
  `objects` = JSON_ARRAY(),
  `scenes` = JSON_ARRAY(),
  `brands` = JSON_ARRAY(),
  `qualityFlags` = JSON_ARRAY(),
  `qualityScore` = 0.6,
  `usabilityScore` = 0.6;

CREATE TABLE `VideoAssemblyProject` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productCategory` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `narrationText` LONGTEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `progress` INTEGER NOT NULL DEFAULT 0,
  `stage` VARCHAR(191) NOT NULL DEFAULT '等待规划',
  `errorMessage` TEXT NOT NULL,
  `aspectRatio` VARCHAR(191) NOT NULL DEFAULT '9:16',
  `removeSourceSubtitles` BOOLEAN NOT NULL DEFAULT true,
  `narrationAudioFileName` VARCHAR(191) NOT NULL DEFAULT '',
  `narrationAudioPath` TEXT NOT NULL,
  `outputFileName` VARCHAR(191) NOT NULL DEFAULT '',
  `outputPath` TEXT NOT NULL,
  `durationMs` INTEGER NOT NULL DEFAULT 0,
  `aiModel` VARCHAR(191) NOT NULL DEFAULT '',
  `aiInputTokens` INTEGER NOT NULL DEFAULT 0,
  `aiOutputTokens` INTEGER NOT NULL DEFAULT 0,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,

  INDEX `VideoAssemblyProject_productCategory_createdAt_idx`(`productCategory`, `createdAt`),
  INDEX `VideoAssemblyProject_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VideoAssemblyScene` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `projectId` INTEGER NOT NULL,
  `sceneIndex` INTEGER NOT NULL,
  `narrationText` TEXT NOT NULL,
  `targetDurationMs` INTEGER NOT NULL DEFAULT 5000,
  `visualBrief` TEXT NOT NULL,
  `contentTypes` JSON NOT NULL,
  `shotTypes` JSON NOT NULL,
  `keywords` JSON NOT NULL,
  `negativeKeywords` JSON NOT NULL,
  `selectedClipId` INTEGER NULL,
  `clipStartOffsetMs` INTEGER NOT NULL DEFAULT 0,
  `clipDurationMs` INTEGER NOT NULL DEFAULT 0,
  `matchScore` DOUBLE NULL,
  `matchReason` TEXT NOT NULL,
  `candidates` JSON NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VideoAssemblyScene_projectId_sceneIndex_key`(`projectId`, `sceneIndex`),
  INDEX `VideoAssemblyScene_projectId_sceneIndex_idx`(`projectId`, `sceneIndex`),
  INDEX `VideoAssemblyScene_selectedClipId_idx`(`selectedClipId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VideoAssemblyScene`
  ADD CONSTRAINT `VideoAssemblyScene_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `VideoAssemblyProject`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `VideoAssemblyScene`
  ADD CONSTRAINT `VideoAssemblyScene_selectedClipId_fkey`
  FOREIGN KEY (`selectedClipId`) REFERENCES `VideoMaterialClip`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
