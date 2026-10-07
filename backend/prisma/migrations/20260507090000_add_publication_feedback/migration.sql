CREATE TABLE `GeoPublicationOption` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GeoPublicationOption_type_label_key`(`type`, `label`),
  INDEX `GeoPublicationOption_type_sortOrder_idx`(`type`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeoPublicationRecord` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `publishedAt` DATETIME(3) NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `accountType` VARCHAR(191) NOT NULL,
  `author` VARCHAR(191) NOT NULL,
  `promptCode` VARCHAR(191) NOT NULL,
  `link` VARCHAR(2048) NOT NULL,
  `promptBatchJobItemId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `GeoPublicationRecord_publishedAt_createdAt_idx`(`publishedAt`, `createdAt`),
  INDEX `GeoPublicationRecord_product_publishedAt_idx`(`product`, `publishedAt`),
  INDEX `GeoPublicationRecord_platform_publishedAt_idx`(`platform`, `publishedAt`),
  INDEX `GeoPublicationRecord_accountType_publishedAt_idx`(`accountType`, `publishedAt`),
  INDEX `GeoPublicationRecord_promptCode_idx`(`promptCode`),
  INDEX `GeoPublicationRecord_promptBatchJobItemId_idx`(`promptBatchJobItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GeoPublicationRecord`
  ADD CONSTRAINT `GeoPublicationRecord_promptBatchJobItemId_fkey`
  FOREIGN KEY (`promptBatchJobItemId`) REFERENCES `GeoPromptBatchJobItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
