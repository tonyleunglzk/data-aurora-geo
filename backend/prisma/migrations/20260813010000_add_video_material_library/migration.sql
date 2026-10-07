CREATE TABLE `VideoMaterial` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productCategory` VARCHAR(191) NOT NULL,
  `originalName` VARCHAR(191) NOT NULL,
  `sourceFileName` VARCHAR(191) NOT NULL,
  `sourcePath` TEXT NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL DEFAULT '',
  `fileSizeBytes` VARCHAR(191) NOT NULL DEFAULT '0',
  `durationMs` INTEGER NOT NULL DEFAULT 0,
  `width` INTEGER NOT NULL DEFAULT 0,
  `height` INTEGER NOT NULL DEFAULT 0,
  `fps` DOUBLE NOT NULL DEFAULT 0,
  `videoCodec` VARCHAR(191) NOT NULL DEFAULT '',
  `audioCodec` VARCHAR(191) NOT NULL DEFAULT '',
  `hasAudio` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `progress` INTEGER NOT NULL DEFAULT 0,
  `stage` VARCHAR(191) NOT NULL DEFAULT '等待处理',
  `errorMessage` TEXT NOT NULL,
  `sceneThreshold` DOUBLE NOT NULL DEFAULT 0.3,
  `minClipDurationMs` INTEGER NOT NULL DEFAULT 1500,
  `clipCount` INTEGER NOT NULL DEFAULT 0,
  `metadata` JSON NOT NULL,
  `processingStartedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VideoMaterial_sourceFileName_key`(`sourceFileName`),
  INDEX `VideoMaterial_productCategory_status_createdAt_idx`(`productCategory`, `status`, `createdAt`),
  INDEX `VideoMaterial_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VideoMaterialClip` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `materialId` INTEGER NOT NULL,
  `clipIndex` INTEGER NOT NULL,
  `startMs` INTEGER NOT NULL,
  `endMs` INTEGER NOT NULL,
  `durationMs` INTEGER NOT NULL,
  `clipFileName` VARCHAR(191) NOT NULL,
  `keyframeFileName` VARCHAR(191) NOT NULL,
  `contentType` VARCHAR(191) NOT NULL DEFAULT 'UNCLASSIFIED',
  `description` TEXT NOT NULL,
  `tags` JSON NOT NULL,
  `confidence` DOUBLE NULL,
  `reviewStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VideoMaterialClip_materialId_clipIndex_key`(`materialId`, `clipIndex`),
  INDEX `VideoMaterialClip_materialId_startMs_idx`(`materialId`, `startMs`),
  INDEX `VideoMaterialClip_contentType_reviewStatus_idx`(`contentType`, `reviewStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VideoMaterialClip`
  ADD CONSTRAINT `VideoMaterialClip_materialId_fkey`
  FOREIGN KEY (`materialId`) REFERENCES `VideoMaterial`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
