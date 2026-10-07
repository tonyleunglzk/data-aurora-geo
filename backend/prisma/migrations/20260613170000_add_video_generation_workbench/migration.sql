CREATE TABLE `VideoGenerationTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('CAT_TALK', 'HUMAN_TALK', 'PRODUCT_SHOWCASE', 'KNOWLEDGE_EXPLAINER', 'SEEDING_RECOMMENDATION', 'COMPARISON_REVIEW', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
  `description` TEXT NOT NULL,
  `model` VARCHAR(191) NOT NULL,
  `resolution` VARCHAR(191) NOT NULL,
  `ratio` VARCHAR(191) NOT NULL,
  `duration` INTEGER NOT NULL,
  `generateAudio` BOOLEAN NOT NULL DEFAULT true,
  `watermark` BOOLEAN NOT NULL DEFAULT false,
  `promptTemplate` LONGTEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VideoGenerationTemplate_key_key`(`key`),
  INDEX `VideoGenerationTemplate_isActive_sortOrder_updatedAt_idx`(`isActive`, `sortOrder`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VideoGenerationCampaign` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `sourceType` ENUM('MANUAL', 'GEO_V3_PRODUCT', 'GEO_V3_RUN', 'GEO_V3_ITEM') NOT NULL,
  `status` ENUM('DRAFT', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
  `templateId` INTEGER NULL,
  `templateName` VARCHAR(191) NOT NULL DEFAULT '',
  `productProfileId` INTEGER NULL,
  `geoRunId` INTEGER NULL,
  `geoItemId` INTEGER NULL,
  `topicText` TEXT NOT NULL,
  `productSnapshot` JSON NULL,
  `sourceSnapshot` JSON NULL,
  `requestedCount` INTEGER NOT NULL DEFAULT 0,
  `successCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `runningCount` INTEGER NOT NULL DEFAULT 0,
  `queuedCount` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `VideoGenerationCampaign_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `VideoGenerationCampaign_sourceType_createdAt_idx`(`sourceType`, `createdAt`),
  INDEX `VideoGenerationCampaign_templateId_createdAt_idx`(`templateId`, `createdAt`),
  INDEX `VideoGenerationCampaign_productProfileId_createdAt_idx`(`productProfileId`, `createdAt`),
  INDEX `VideoGenerationCampaign_geoRunId_createdAt_idx`(`geoRunId`, `createdAt`),
  INDEX `VideoGenerationCampaign_geoItemId_createdAt_idx`(`geoItemId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VideoGenerationTask` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `campaignId` INTEGER NULL,
  `providerTaskId` VARCHAR(191) NOT NULL,
  `status` ENUM('CREATED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'CREATED',
  `model` VARCHAR(191) NOT NULL,
  `resolution` VARCHAR(191) NOT NULL,
  `ratio` VARCHAR(191) NOT NULL,
  `duration` INTEGER NOT NULL,
  `generateAudio` BOOLEAN NOT NULL DEFAULT true,
  `watermark` BOOLEAN NOT NULL DEFAULT false,
  `promptText` LONGTEXT NOT NULL,
  `content` JSON NOT NULL,
  `referenceAssets` JSON NULL,
  `productSnapshot` JSON NULL,
  `sourceSnapshot` JSON NULL,
  `videoUrl` VARCHAR(4096) NOT NULL DEFAULT '',
  `usage` JSON NULL,
  `seed` INTEGER NULL,
  `framesPerSecond` INTEGER NULL,
  `serviceTier` VARCHAR(191) NOT NULL DEFAULT '',
  `errorCode` VARCHAR(191) NOT NULL DEFAULT '',
  `errorMessage` TEXT NOT NULL,
  `arkResponse` JSON NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VideoGenerationTask_providerTaskId_key`(`providerTaskId`),
  INDEX `VideoGenerationTask_campaignId_status_idx`(`campaignId`, `status`),
  INDEX `VideoGenerationTask_status_updatedAt_idx`(`status`, `updatedAt`),
  INDEX `VideoGenerationTask_model_createdAt_idx`(`model`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VideoGenerationCampaign`
  ADD CONSTRAINT `VideoGenerationCampaign_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `VideoGenerationTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationCampaign`
  ADD CONSTRAINT `VideoGenerationCampaign_productProfileId_fkey`
  FOREIGN KEY (`productProfileId`) REFERENCES `GeoMainProductProfileV3`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationCampaign`
  ADD CONSTRAINT `VideoGenerationCampaign_geoRunId_fkey`
  FOREIGN KEY (`geoRunId`) REFERENCES `GeoPromptV3GenerationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationCampaign`
  ADD CONSTRAINT `VideoGenerationCampaign_geoItemId_fkey`
  FOREIGN KEY (`geoItemId`) REFERENCES `GeoPromptV3GenerationItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VideoGenerationTask`
  ADD CONSTRAINT `VideoGenerationTask_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `VideoGenerationCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
