-- CreateTable
CREATE TABLE `GeoSerpResearchProject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(191) NOT NULL,
    `rankLimit` INTEGER NOT NULL,
    `engine` VARCHAR(191) NOT NULL DEFAULT 'baidu',
    `domainFilter` VARCHAR(191) NOT NULL DEFAULT 'baijiahao.baidu.com',
    `status` ENUM('SUCCEEDED', 'BLOCKED', 'FAILED') NOT NULL,
    `statusMessage` VARCHAR(191) NOT NULL DEFAULT '',
    `inspectedCount` INTEGER NOT NULL DEFAULT 0,
    `matchedCount` INTEGER NOT NULL DEFAULT 0,
    `baiduBlockedDetected` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeoSerpResearchResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `rank` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `snippet` VARCHAR(191) NOT NULL DEFAULT '',
    `searchUrl` TEXT NOT NULL,
    `finalUrl` TEXT NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `fetchStatus` ENUM('ANALYZED', 'FETCH_FAILED') NOT NULL,
    `fetchMessage` VARCHAR(191) NOT NULL DEFAULT '',
    `contentLength` INTEGER NOT NULL DEFAULT 0,
    `paragraphCount` INTEGER NOT NULL DEFAULT 0,
    `titleLength` INTEGER NOT NULL DEFAULT 0,
    `keywordHits` JSON NOT NULL,
    `patternTags` JSON NOT NULL,
    `headingOutline` JSON NOT NULL,
    `analysisSummary` JSON NOT NULL,
    `articleExcerpt` TEXT NOT NULL,
    `publishAt` VARCHAR(191) NOT NULL DEFAULT '',
    `author` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GeoSerpResearchResult_projectId_rank_idx`(`projectId`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GeoSerpResearchResult` ADD CONSTRAINT `GeoSerpResearchResult_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `GeoSerpResearchProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
