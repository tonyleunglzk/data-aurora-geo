CREATE TABLE `GeoPromptEngineV3FixedRules` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `ruleText` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `GeoPromptEngineV3FixedRules` (`id`, `ruleText`, `createdAt`, `updatedAt`)
SELECT 1, `ruleText`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `GeoPromptEngineV2FixedRules`
WHERE `id` = 1
ON DUPLICATE KEY UPDATE `ruleText` = VALUES(`ruleText`), `updatedAt` = CURRENT_TIMESTAMP(3);
