-- CreateTable
CREATE TABLE `ChangelogEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NOT NULL,
    `releaseDate` DATETIME(3) NOT NULL,
    `summary` TEXT NOT NULL,
    `addedItems` JSON NOT NULL,
    `changedItems` JSON NOT NULL,
    `removedItems` JSON NOT NULL,
    `affectedModules` JSON NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChangelogEntry_batchNo_key`(`batchNo`),
    INDEX `ChangelogEntry_releaseDate_createdAt_idx`(`releaseDate`, `createdAt`),
    INDEX `ChangelogEntry_publishedAt_createdAt_idx`(`publishedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
