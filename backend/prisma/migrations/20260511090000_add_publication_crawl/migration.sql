CREATE TABLE `GeoPublicationCrawlSetting` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `isEnabled` BOOLEAN NOT NULL DEFAULT false,
  `dailyRunTime` VARCHAR(191) NOT NULL DEFAULT '08:00',
  `lookbackDays` INTEGER NOT NULL DEFAULT 90,
  `maxKeywordsPerRun` INTEGER NOT NULL DEFAULT 30,
  `requestIntervalMinSec` INTEGER NOT NULL DEFAULT 3,
  `requestIntervalMaxSec` INTEGER NOT NULL DEFAULT 8,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPublicationCrawlKeyword` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `product` VARCHAR(191) NOT NULL,
  `keyword` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GeoPublicationCrawlKeyword_product_keyword_key`(`product`, `keyword`),
  INDEX `GeoPublicationCrawlKeyword_isActive_product_sortOrder_idx`(`isActive`, `product`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPublicationCrawlJob` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `triggerType` VARCHAR(191) NOT NULL,
  `scheduleDate` VARCHAR(191) NOT NULL DEFAULT '',
  `product` VARCHAR(191) NOT NULL DEFAULT '',
  `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `keywordCount` INTEGER NOT NULL DEFAULT 0,
  `successCount` INTEGER NOT NULL DEFAULT 0,
  `noAiCount` INTEGER NOT NULL DEFAULT 0,
  `blockedCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `runningCount` INTEGER NOT NULL DEFAULT 0,
  `queuedCount` INTEGER NOT NULL DEFAULT 0,
  `matchedCitationCount` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NOT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPublicationCrawlJob_status_updatedAt_idx`(`status`, `updatedAt`),
  INDEX `GeoPublicationCrawlJob_triggerType_scheduleDate_idx`(`triggerType`, `scheduleDate`),
  INDEX `GeoPublicationCrawlJob_product_createdAt_idx`(`product`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPublicationCrawlResult` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `jobId` INTEGER NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `keyword` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'NO_AI', 'BLOCKED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `aiTitle` VARCHAR(191) NOT NULL DEFAULT '',
  `contentSummary` TEXT NOT NULL,
  `rawContent` LONGTEXT NOT NULL,
  `citationCount` INTEGER NOT NULL DEFAULT 0,
  `matchedCitationCount` INTEGER NOT NULL DEFAULT 0,
  `blockedDetected` BOOLEAN NOT NULL DEFAULT false,
  `errorMessage` TEXT NOT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GeoPublicationCrawlResult_jobId_keyword_key`(`jobId`, `keyword`),
  INDEX `GeoPublicationCrawlResult_status_updatedAt_idx`(`status`, `updatedAt`),
  INDEX `GeoPublicationCrawlResult_product_keyword_idx`(`product`, `keyword`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPublicationCrawlCitation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `resultId` INTEGER NOT NULL,
  `publicationRecordId` INTEGER NULL,
  `url` VARCHAR(2048) NOT NULL,
  `normalizedUrl` VARCHAR(2048) NOT NULL,
  `externalId` VARCHAR(191) NOT NULL DEFAULT '',
  `title` VARCHAR(191) NOT NULL DEFAULT '',
  `sourceName` VARCHAR(191) NOT NULL DEFAULT '',
  `authorName` VARCHAR(191) NOT NULL DEFAULT '',
  `brand` VARCHAR(191) NOT NULL DEFAULT '',
  `publishTime` VARCHAR(191) NOT NULL DEFAULT '',
  `isMatched` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPublicationCrawlCitation_resultId_idx`(`resultId`),
  INDEX `GeoPublicationCrawlCitation_publicationRecordId_createdAt_idx`(`publicationRecordId`, `createdAt`),
  INDEX `GeoPublicationCrawlCitation_externalId_idx`(`externalId`),
  INDEX `GeoPublicationCrawlCitation_isMatched_createdAt_idx`(`isMatched`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GeoPublicationCrawlResult`
  ADD CONSTRAINT `GeoPublicationCrawlResult_jobId_fkey`
  FOREIGN KEY (`jobId`) REFERENCES `GeoPublicationCrawlJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GeoPublicationCrawlCitation`
  ADD CONSTRAINT `GeoPublicationCrawlCitation_resultId_fkey`
  FOREIGN KEY (`resultId`) REFERENCES `GeoPublicationCrawlResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GeoPublicationCrawlCitation`
  ADD CONSTRAINT `GeoPublicationCrawlCitation_publicationRecordId_fkey`
  FOREIGN KEY (`publicationRecordId`) REFERENCES `GeoPublicationRecord`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
