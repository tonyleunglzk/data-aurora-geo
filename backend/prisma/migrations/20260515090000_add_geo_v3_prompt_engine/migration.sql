CREATE TABLE `GeoPromptEngineV3Version` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `sourceArticleUrl` VARCHAR(2048) NOT NULL DEFAULT '',
  `sourceArticleTitle` VARCHAR(191) NOT NULL DEFAULT '',
  `structureRules` TEXT NOT NULL,
  `titleRules` TEXT NOT NULL,
  `paragraphRules` TEXT NOT NULL,
  `seoGeoRules` TEXT NOT NULL,
  `forbiddenRules` TEXT NOT NULL,
  `notes` TEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPromptEngineV3Version_isActive_sortOrder_updatedAt_idx`(`isActive`, `sortOrder`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPromptVariableSet` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPromptVariableSet_isActive_sortOrder_updatedAt_idx`(`isActive`, `sortOrder`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPromptVariableItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `setId` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `pickMode` ENUM('ONE', 'MANY') NOT NULL DEFAULT 'ONE',
  `pickMin` INTEGER NOT NULL DEFAULT 1,
  `pickMax` INTEGER NOT NULL DEFAULT 1,
  `candidates` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPromptVariableItem_setId_sortOrder_idx`(`setId`, `sortOrder`),
  INDEX `GeoPromptVariableItem_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoMainProductProfileV3` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `brand` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `coreParameters` TEXT NOT NULL,
  `requiredContent` JSON NOT NULL,
  `randomContentPool` JSON NOT NULL,
  `randomPickMin` INTEGER NOT NULL DEFAULT 0,
  `randomPickMax` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoMainProductProfileV3_isActive_sortOrder_updatedAt_idx`(`isActive`, `sortOrder`, `updatedAt`),
  INDEX `GeoMainProductProfileV3_category_updatedAt_idx`(`category`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPromptV3GenerationRun` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `mode` ENUM('SINGLE', 'BATCH') NOT NULL,
  `status` ENUM('COMPLETED', 'PARTIAL_FAILED', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
  `versionId` INTEGER NULL,
  `variableSetId` INTEGER NULL,
  `productProfileId` INTEGER NULL,
  `versionName` VARCHAR(191) NOT NULL,
  `variableSetName` VARCHAR(191) NOT NULL,
  `productProfileName` VARCHAR(191) NOT NULL,
  `topic` VARCHAR(191) NOT NULL DEFAULT '',
  `extraRequirements` TEXT NOT NULL,
  `versionSnapshot` JSON NOT NULL,
  `variableSetSnapshot` JSON NOT NULL,
  `productSnapshot` JSON NOT NULL,
  `requestedCount` INTEGER NOT NULL,
  `successCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `zipFileName` VARCHAR(191) NOT NULL DEFAULT '',
  `lastError` TEXT NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPromptV3GenerationRun_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `GeoPromptV3GenerationRun_mode_createdAt_idx`(`mode`, `createdAt`),
  INDEX `GeoPromptV3GenerationRun_versionId_createdAt_idx`(`versionId`, `createdAt`),
  INDEX `GeoPromptV3GenerationRun_variableSetId_createdAt_idx`(`variableSetId`, `createdAt`),
  INDEX `GeoPromptV3GenerationRun_productProfileId_createdAt_idx`(`productProfileId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPromptV3GenerationItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `runId` INTEGER NOT NULL,
  `itemIndex` INTEGER NOT NULL,
  `status` ENUM('SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'SUCCEEDED',
  `fileName` VARCHAR(191) NOT NULL DEFAULT '',
  `promptText` LONGTEXT NOT NULL,
  `selectedVariables` JSON NOT NULL,
  `selectedProductContent` JSON NOT NULL,
  `errorMessage` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GeoPromptV3GenerationItem_runId_itemIndex_key`(`runId`, `itemIndex`),
  INDEX `GeoPromptV3GenerationItem_runId_itemIndex_idx`(`runId`, `itemIndex`),
  INDEX `GeoPromptV3GenerationItem_status_updatedAt_idx`(`status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GeoPromptVariableItem`
  ADD CONSTRAINT `GeoPromptVariableItem_setId_fkey`
  FOREIGN KEY (`setId`) REFERENCES `GeoPromptVariableSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GeoPromptV3GenerationRun`
  ADD CONSTRAINT `GeoPromptV3GenerationRun_versionId_fkey`
  FOREIGN KEY (`versionId`) REFERENCES `GeoPromptEngineV3Version`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GeoPromptV3GenerationRun`
  ADD CONSTRAINT `GeoPromptV3GenerationRun_variableSetId_fkey`
  FOREIGN KEY (`variableSetId`) REFERENCES `GeoPromptVariableSet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GeoPromptV3GenerationRun`
  ADD CONSTRAINT `GeoPromptV3GenerationRun_productProfileId_fkey`
  FOREIGN KEY (`productProfileId`) REFERENCES `GeoMainProductProfileV3`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GeoPromptV3GenerationItem`
  ADD CONSTRAINT `GeoPromptV3GenerationItem_runId_fkey`
  FOREIGN KEY (`runId`) REFERENCES `GeoPromptV3GenerationRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
