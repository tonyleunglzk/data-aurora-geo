/*
  Warnings:

  - You are about to drop the column `systemSubtitle` on the `AppSetting` table. All the data in the column will be lost.
  - You are about to drop the column `themeName` on the `AppSetting` table. All the data in the column will be lost.
  - You are about to drop the column `welcomeMessage` on the `AppSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `AppSetting` DROP COLUMN `systemSubtitle`,
    DROP COLUMN `themeName`,
    DROP COLUMN `welcomeMessage`;
