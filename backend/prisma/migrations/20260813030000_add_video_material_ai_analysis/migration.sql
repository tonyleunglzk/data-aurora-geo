ALTER TABLE `VideoMaterial`
  ADD COLUMN `aiStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED' AFTER `clipCount`,
  ADD COLUMN `aiProgress` INTEGER NOT NULL DEFAULT 0 AFTER `aiStatus`,
  ADD COLUMN `aiStage` VARCHAR(191) NOT NULL DEFAULT '' AFTER `aiProgress`,
  ADD COLUMN `aiErrorMessage` VARCHAR(2000) NOT NULL DEFAULT '' AFTER `aiStage`,
  ADD COLUMN `aiModel` VARCHAR(191) NOT NULL DEFAULT '' AFTER `aiErrorMessage`,
  ADD COLUMN `aiInputTokens` INTEGER NOT NULL DEFAULT 0 AFTER `aiModel`,
  ADD COLUMN `aiOutputTokens` INTEGER NOT NULL DEFAULT 0 AFTER `aiInputTokens`,
  ADD COLUMN `aiAudioSeconds` DOUBLE NOT NULL DEFAULT 0 AFTER `aiOutputTokens`,
  ADD COLUMN `aiStartedAt` DATETIME(3) NULL AFTER `aiAudioSeconds`,
  ADD COLUMN `aiCompletedAt` DATETIME(3) NULL AFTER `aiStartedAt`;

ALTER TABLE `VideoMaterialClip`
  ADD COLUMN `transcript` TEXT NULL AFTER `tags`,
  ADD COLUMN `aiModel` VARCHAR(191) NOT NULL DEFAULT '' AFTER `confidence`,
  ADD COLUMN `analyzedAt` DATETIME(3) NULL AFTER `aiModel`;

CREATE INDEX `VideoMaterial_aiStatus_createdAt_idx`
  ON `VideoMaterial`(`aiStatus`, `createdAt`);
