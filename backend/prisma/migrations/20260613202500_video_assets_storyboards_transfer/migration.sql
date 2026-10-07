ALTER TABLE `VideoGenerationTask`
  ADD COLUMN `transferredVideoUrl` TEXT NULL,
  ADD COLUMN `localVideoPath` TEXT NULL,
  ADD COLUMN `transferStatus` ENUM('NOT_STARTED', 'RUNNING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN `transferError` TEXT NULL,
  ADD COLUMN `transferredAt` DATETIME(3) NULL;

CREATE INDEX `VideoGenerationTask_transferStatus_updatedAt_idx` ON `VideoGenerationTask`(`transferStatus`, `updatedAt`);

CREATE TABLE `VideoGenerationAsset` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productProfileId` INTEGER NULL,
  `campaignId` INTEGER NULL,
  `taskId` INTEGER NULL,
  `planKey` VARCHAR(191) NOT NULL DEFAULT '',
  `title` VARCHAR(191) NOT NULL,
  `kind` ENUM('IMAGE', 'VIDEO', 'AUDIO') NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT '',
  `priority` ENUM('REQUIRED', 'RECOMMENDED', 'OPTIONAL') NOT NULL DEFAULT 'RECOMMENDED',
  `status` ENUM('PLANNED', 'GENERATING', 'READY', 'FAILED') NOT NULL DEFAULT 'PLANNED',
  `sourceType` ENUM('PLANNED', 'UPLOADED', 'GENERATED', 'TRANSFERRED', 'REMOTE') NOT NULL DEFAULT 'PLANNED',
  `stage` VARCHAR(191) NOT NULL DEFAULT '',
  `purpose` TEXT NOT NULL,
  `brief` LONGTEXT NOT NULL,
  `prompt` LONGTEXT NOT NULL,
  `toolHint` VARCHAR(191) NOT NULL DEFAULT '',
  `sourceFields` JSON NULL,
  `url` TEXT NULL,
  `localPath` TEXT NULL,
  `provider` VARCHAR(191) NOT NULL DEFAULT '',
  `providerTaskId` VARCHAR(191) NOT NULL DEFAULT '',
  `model` VARCHAR(191) NOT NULL DEFAULT '',
  `errorMessage` TEXT NOT NULL,
  `productSnapshot` JSON NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `VideoGenerationAsset_productProfileId_status_updatedAt_idx`(`productProfileId`, `status`, `updatedAt`),
  INDEX `VideoGenerationAsset_campaignId_status_updatedAt_idx`(`campaignId`, `status`, `updatedAt`),
  INDEX `VideoGenerationAsset_taskId_sourceType_idx`(`taskId`, `sourceType`),
  INDEX `VideoGenerationAsset_kind_status_updatedAt_idx`(`kind`, `status`, `updatedAt`),
  INDEX `VideoGenerationAsset_planKey_idx`(`planKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VideoGenerationStoryboard` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productProfileId` INTEGER NULL,
  `campaignId` INTEGER NULL,
  `sourceType` ENUM('MANUAL', 'GEO_V3_PRODUCT', 'GEO_V3_RUN', 'GEO_V3_ITEM') NULL,
  `title` VARCHAR(191) NOT NULL,
  `topicText` TEXT NOT NULL,
  `scriptText` LONGTEXT NOT NULL,
  `scenes` JSON NOT NULL,
  `productSnapshot` JSON NULL,
  `sourceSnapshot` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `VideoGenerationStoryboard_productProfileId_createdAt_idx`(`productProfileId`, `createdAt`),
  INDEX `VideoGenerationStoryboard_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
  INDEX `VideoGenerationStoryboard_sourceType_createdAt_idx`(`sourceType`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VideoGenerationAsset`
  ADD CONSTRAINT `VideoGenerationAsset_productProfileId_fkey`
  FOREIGN KEY (`productProfileId`) REFERENCES `GeoMainProductProfileV3`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationAsset`
  ADD CONSTRAINT `VideoGenerationAsset_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `VideoGenerationCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationAsset`
  ADD CONSTRAINT `VideoGenerationAsset_taskId_fkey`
  FOREIGN KEY (`taskId`) REFERENCES `VideoGenerationTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationStoryboard`
  ADD CONSTRAINT `VideoGenerationStoryboard_productProfileId_fkey`
  FOREIGN KEY (`productProfileId`) REFERENCES `GeoMainProductProfileV3`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationStoryboard`
  ADD CONSTRAINT `VideoGenerationStoryboard_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `VideoGenerationCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
