ALTER TABLE `GeoPromptVariableSet`
  ADD COLUMN `versionId` INTEGER NULL;

CREATE INDEX `GeoPromptVariableSet_versionId_isActive_sortOrder_idx`
  ON `GeoPromptVariableSet`(`versionId`, `isActive`, `sortOrder`);

UPDATE `GeoPromptVariableSet`
SET `versionId` = (
  SELECT `id`
  FROM (
    SELECT `id`
    FROM `GeoPromptEngineV3Version`
    ORDER BY `sortOrder` ASC, `updatedAt` DESC, `id` DESC
    LIMIT 1
  ) AS `first_v3_version`
)
WHERE `versionId` IS NULL
  AND EXISTS (SELECT 1 FROM `GeoPromptEngineV3Version`);

ALTER TABLE `GeoPromptVariableSet`
  ADD CONSTRAINT `GeoPromptVariableSet_versionId_fkey`
  FOREIGN KEY (`versionId`) REFERENCES `GeoPromptEngineV3Version`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
