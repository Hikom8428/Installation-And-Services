-- HICON Insta & Serv — MySQL schema for Hostinger phpMyAdmin import
-- Generated from prisma/schema.prisma via:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- HOW TO USE (fresh database only):
-- 1. Open phpMyAdmin on Hostinger, select your app's MySQL database.
-- 2. Go to the "SQL" tab, paste this whole file, and click "Go".
-- 3. This creates all tables and inserts one Master Admin login so you can
--    sign in immediately after deploy.
--
-- If you already have data in these tables, do NOT run this file — use the
-- incremental ALTER SQL provided alongside each feature commit instead, or
-- you will lose data / hit "table already exists" errors.
--
-- Master Admin login (created below):
--   email:    mis@hicon.co.in
--   password: Manoj@123
-- CHANGE THIS PASSWORD after your first login (via the Manage Users flow,
-- or by updating the `password` column with a new bcrypt hash).

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'DOER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Installation` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NULL,
    `customerAddress` VARCHAR(191) NULL,
    `productDetails` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `currentCycle` INTEGER NOT NULL DEFAULT 1,
    `syncDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `data` JSON NULL,

    UNIQUE INDEX `Installation_sourceId_key`(`sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `taskType` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `doerId` VARCHAR(191) NULL,
    `doerName` VARCHAR(191) NOT NULL DEFAULT '',
    `cycle` INTEGER NOT NULL DEFAULT 1,
    `fundAmount` DOUBLE NULL,
    `fundNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaskAssignment_taskType_taskId_doerId_cycle_key`(`taskType`, `taskId`, `doerId`, `cycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `columns` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskStep` (
    `id` VARCHAR(191) NOT NULL,
    `taskType` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `cycle` INTEGER NOT NULL DEFAULT 1,
    `sitePhotoUrl` VARCHAR(191) NULL,
    `siteVideoUrl` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `step1At` DATETIME(3) NULL,
    `evidenceUrl` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `chartUrl` VARCHAR(191) NULL,
    `step2At` DATETIME(3) NULL,
    `expenseAmount` DOUBLE NULL,
    `expenseNotes` VARCHAR(191) NULL,
    `billUrls` JSON NULL,
    `step3At` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaskStep_taskType_taskId_cycle_key`(`taskType`, `taskId`, `cycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteVisit` (
    `id` VARCHAR(191) NOT NULL,
    `serialNo` INTEGER NOT NULL AUTO_INCREMENT,
    `raisedById` VARCHAR(191) NULL,
    `raisedVia` VARCHAR(191) NULL,
    `raisedByName` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `siteAddress` VARCHAR(191) NULL,
    `siteLatitude` DOUBLE NULL,
    `siteLongitude` DOUBLE NULL,
    `attendantName` VARCHAR(191) NULL,
    `attendantPhone` VARCHAR(191) NULL,
    `visitFor` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `currentCycle` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteVisit_serialNo_key`(`serialNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Complaint` (
    `id` VARCHAR(191) NOT NULL,
    `jobNo` VARCHAR(191) NULL,
    `doorSerialNo` VARCHAR(191) NULL,
    `warrantyStatus` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `siteAddress` VARCHAR(191) NULL,
    `siteLatitude` DOUBLE NULL,
    `siteLongitude` DOUBLE NULL,
    `attendantName` VARCHAR(191) NULL,
    `attendantPhone` VARCHAR(191) NULL,
    `issueDescription` VARCHAR(191) NOT NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `mediaUrls` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `currentCycle` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_doerId_fkey` FOREIGN KEY (`doerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteVisit` ADD CONSTRAINT `SiteVisit_raisedById_fkey` FOREIGN KEY (`raisedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: Master Admin user (password: Manoj@123 — change after first login)
INSERT INTO `User` (`id`, `name`, `email`, `password`, `role`, `createdAt`, `updatedAt`)
VALUES (
    'c5037b51-8510-4881-8cc6-890b65869358',
    'Master Admin',
    'mis@hicon.co.in',
    '$2a$10$FbVjNw8QFUhNVbS0gF/kqeigXJeb2t4OVM4bXa4aupB8ZCzydc8he',
    'MASTER',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);
