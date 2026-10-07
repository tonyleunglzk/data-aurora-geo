ALTER TABLE `GeoPromptEngineV3Version`
  ADD COLUMN `ruleText` TEXT NULL;

UPDATE `GeoPromptEngineV3Version`
SET `ruleText` = TRIM(CONCAT(
  '## 文章结构规则\n', COALESCE(`structureRules`, ''), '\n\n',
  '## 标题规则\n', COALESCE(`titleRules`, ''), '\n\n',
  '## 段落规则\n', COALESCE(`paragraphRules`, ''), '\n\n',
  '## SEO / GEO 布局\n', COALESCE(`seoGeoRules`, ''), '\n\n',
  '## 禁用项\n', COALESCE(`forbiddenRules`, ''), '\n\n',
  '## 备注\n', COALESCE(`notes`, '')
));

UPDATE `GeoPromptEngineV3Version`
SET `ruleText` = 'V3 版本规则待完善。'
WHERE `ruleText` IS NULL OR TRIM(`ruleText`) = '';

ALTER TABLE `GeoPromptEngineV3Version`
  MODIFY `ruleText` TEXT NOT NULL;

CREATE TABLE `GeoPromptV3VersionDraftSession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `articleText` LONGTEXT NOT NULL,
  `articleUrl` VARCHAR(2048) NOT NULL DEFAULT '',
  `notes` TEXT NOT NULL,
  `model` VARCHAR(191) NOT NULL DEFAULT '',
  `messages` JSON NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `ownerUserId` INTEGER NULL,
  `ownerName` VARCHAR(191) NOT NULL DEFAULT '',
  `suggestedName` VARCHAR(191) NOT NULL DEFAULT '',
  `suggestedDescription` TEXT NOT NULL,
  `suggestedRuleText` TEXT NOT NULL,
  `suggestedVariableSetDraft` JSON NOT NULL,
  `sourceV2SessionId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GeoPromptV3VersionDraftSession_status_updatedAt_idx`
  ON `GeoPromptV3VersionDraftSession`(`status`, `updatedAt`);

CREATE INDEX `GeoPromptV3VersionDraftSession_ownerUserId_updatedAt_idx`
  ON `GeoPromptV3VersionDraftSession`(`ownerUserId`, `updatedAt`);

CREATE INDEX `GeoPromptV3VersionDraftSession_sourceV2SessionId_idx`
  ON `GeoPromptV3VersionDraftSession`(`sourceV2SessionId`);
