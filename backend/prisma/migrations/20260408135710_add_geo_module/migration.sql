-- CreateTable
CREATE TABLE `GeoProviderConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `apiKey` VARCHAR(191) NOT NULL DEFAULT '',
    `baseUrl` VARCHAR(191) NOT NULL DEFAULT '',
    `model` VARCHAR(191) NOT NULL DEFAULT 'claude-opus-4-6-20250219',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeoProductProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileName` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `specs` VARCHAR(191) NOT NULL,
    `targetAudience` VARCHAR(191) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `keywordMode` VARCHAR(191) NOT NULL DEFAULT 'exact',
    `sellingPoints` JSON NOT NULL,
    `sellingPointsRange` VARCHAR(191) NOT NULL,
    `emphasis` JSON NOT NULL,
    `emphasisRange` VARCHAR(191) NOT NULL,
    `seoKeywords` JSON NOT NULL,
    `brandPool` JSON NOT NULL,
    `brandPoolCount` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeoProductProfile_profileName_key`(`profileName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
