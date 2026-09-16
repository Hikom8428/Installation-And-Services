-- HICON Insta & Serv — MySQL schema for Hostinger phpMyAdmin import
-- Generated from prisma/schema.prisma via:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- HOW TO USE:
-- 1. Open phpMyAdmin on Hostinger, select your app's MySQL database.
-- 2. Go to the "SQL" tab, paste this whole file, and click "Go".
-- 3. This creates the 3 tables (User, Installation, Complaint) and inserts
--    one Master Admin login so you can sign in immediately after deploy.
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
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NULL,
    `customerAddress` VARCHAR(191) NULL,
    `productDetails` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedDoerId` VARCHAR(191) NULL,
    `syncDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Complaint` (
    `id` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `issueDescription` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedDoerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Installation` ADD CONSTRAINT `Installation_assignedDoerId_fkey` FOREIGN KEY (`assignedDoerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_assignedDoerId_fkey` FOREIGN KEY (`assignedDoerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
