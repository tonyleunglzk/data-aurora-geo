ALTER TABLE `GeoPromptEngineVersion`
  ADD COLUMN `articleText` LONGTEXT NULL;

UPDATE `GeoPromptEngineVersion`
SET `articleText` = ''
WHERE `articleText` IS NULL;

ALTER TABLE `GeoPromptEngineVersion`
  MODIFY `articleText` LONGTEXT NOT NULL;

ALTER TABLE `GeoPromptEngineV3Version`
  ADD COLUMN `sourceArticleText` LONGTEXT NULL;

UPDATE `GeoPromptEngineV3Version`
SET `sourceArticleText` = ''
WHERE `sourceArticleText` IS NULL;

ALTER TABLE `GeoPromptEngineV3Version`
  MODIFY `sourceArticleText` LONGTEXT NOT NULL;
