ALTER TABLE `VideoMaterialClip`
  ADD COLUMN `shotType` VARCHAR(191) NOT NULL DEFAULT 'UNCLASSIFIED' AFTER `keyframeFileName`;

CREATE INDEX `VideoMaterialClip_shotType_reviewStatus_idx`
  ON `VideoMaterialClip`(`shotType`, `reviewStatus`);

ALTER TABLE `VideoMaterial`
  MODIFY COLUMN `minClipDurationMs` INTEGER NOT NULL DEFAULT 4000;
