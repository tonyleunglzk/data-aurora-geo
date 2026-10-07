ALTER TABLE `GeoPromptV3GenerationRun`
  ADD COLUMN `fixedRulesMode` ENUM('SYSTEM', 'NONE') NOT NULL DEFAULT 'SYSTEM' AFTER `mode`;
