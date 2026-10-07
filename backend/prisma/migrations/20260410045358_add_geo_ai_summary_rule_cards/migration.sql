-- AlterTable
ALTER TABLE `GeoSerpResearchProject` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT '未分类';

-- CreateTable
CREATE TABLE `GeoSerpAiSummary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `rawSummary` TEXT NOT NULL,
    `titlePatterns` JSON NOT NULL,
    `leadPatterns` JSON NOT NULL,
    `sectionBlueprint` JSON NOT NULL,
    `keywordPlacement` JSON NOT NULL,
    `sellingPointOrder` JSON NOT NULL,
    `trustSignals` JSON NOT NULL,
    `endingPatterns` JSON NOT NULL,
    `antiPatterns` JSON NOT NULL,
    `rankingHypotheses` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeoSerpAiSummary_projectId_key`(`projectId`),
    INDEX `GeoSerpAiSummary_category_updatedAt_idx`(`category`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeoRuleCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `rawSummary` TEXT NOT NULL,
    `titlePatterns` JSON NOT NULL,
    `leadPatterns` JSON NOT NULL,
    `sectionBlueprint` JSON NOT NULL,
    `keywordPlacement` JSON NOT NULL,
    `sellingPointOrder` JSON NOT NULL,
    `trustSignals` JSON NOT NULL,
    `endingPatterns` JSON NOT NULL,
    `antiPatterns` JSON NOT NULL,
    `rankingHypotheses` JSON NOT NULL,
    `sourceSummaryCount` INTEGER NOT NULL DEFAULT 0,
    `sourceSummaryIds` JSON NOT NULL,
    `sourceTimeStart` DATETIME(3) NULL,
    `sourceTimeEnd` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GeoRuleCard_category_isActive_idx`(`category`, `isActive`),
    INDEX `GeoRuleCard_category_updatedAt_idx`(`category`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `GeoSerpResearchProject_category_updatedAt_idx` ON `GeoSerpResearchProject`(`category`, `updatedAt`);

-- AddForeignKey
ALTER TABLE `GeoSerpAiSummary` ADD CONSTRAINT `GeoSerpAiSummary_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `GeoSerpResearchProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
