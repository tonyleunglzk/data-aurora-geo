ALTER TABLE `VideoMaterial`
  ADD COLUMN `maxClipDurationMs` INTEGER NOT NULL DEFAULT 15000 AFTER `minClipDurationMs`;
