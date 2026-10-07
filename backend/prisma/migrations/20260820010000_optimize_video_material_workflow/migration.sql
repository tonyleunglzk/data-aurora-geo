ALTER TABLE `VideoMaterialClip`
  ADD COLUMN `transcriptContext` TEXT NULL,
  ADD COLUMN `speechBoundaryStatus` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `motionScore` DOUBLE NULL;

UPDATE `VideoMaterialClip`
SET `transcriptContext` = COALESCE(`transcript`, '')
WHERE `transcriptContext` IS NULL;

ALTER TABLE `VideoMaterialClip`
  MODIFY COLUMN `transcriptContext` TEXT NOT NULL;

ALTER TABLE `VideoAssemblyProject`
  ADD COLUMN `sourceMode` VARCHAR(191) NOT NULL DEFAULT 'ALL',
  ADD COLUMN `framingMode` VARCHAR(191) NOT NULL DEFAULT 'FILL_CROP';

ALTER TABLE `VideoAssemblyScene`
  ADD COLUMN `visualIntent` VARCHAR(191) NOT NULL DEFAULT 'MIXED';

CREATE TABLE `VideoMaterialTranscriptSegment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `materialId` INTEGER NOT NULL,
  `segmentIndex` INTEGER NOT NULL,
  `startMs` INTEGER NOT NULL,
  `endMs` INTEGER NOT NULL,
  `text` TEXT NOT NULL,
  `words` JSON NULL,
  `model` VARCHAR(191) NOT NULL DEFAULT '',
  `chunkIndex` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VideoMaterialTranscriptSegment_materialId_segmentIndex_key`(`materialId`, `segmentIndex`),
  INDEX `VideoMaterialTranscriptSegment_materialId_startMs_idx`(`materialId`, `startMs`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VideoAssemblyProjectMaterial` (
  `projectId` INTEGER NOT NULL,
  `materialId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `VideoAssemblyProjectMaterial_materialId_idx`(`materialId`),
  PRIMARY KEY (`projectId`, `materialId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VideoMaterialTranscriptSegment`
  ADD CONSTRAINT `VideoMaterialTranscriptSegment_materialId_fkey`
  FOREIGN KEY (`materialId`) REFERENCES `VideoMaterial`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `VideoAssemblyProjectMaterial`
  ADD CONSTRAINT `VideoAssemblyProjectMaterial_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `VideoAssemblyProject`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `VideoAssemblyProjectMaterial`
  ADD CONSTRAINT `VideoAssemblyProjectMaterial_materialId_fkey`
  FOREIGN KEY (`materialId`) REFERENCES `VideoMaterial`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
