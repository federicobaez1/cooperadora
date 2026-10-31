-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'TESORERO', 'CONSULTA') NOT NULL DEFAULT 'CONSULTA',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guardian` (
    `id` VARCHAR(36) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `dni` VARCHAR(20) NOT NULL,
    `email` VARCHAR(180) NULL,
    `phone` VARCHAR(40) NULL,
    `address` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Guardian_dni_key`(`dni`),
    INDEX `Guardian_lastName_firstName_idx`(`lastName`, `firstName`),
    INDEX `Guardian_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Student` (
    `id` VARCHAR(36) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `dni` VARCHAR(20) NOT NULL,
    `birthDate` DATE NULL,
    `course` VARCHAR(20) NOT NULL,
    `division` VARCHAR(20) NOT NULL,
    `shift` VARCHAR(20) NOT NULL,
    `status` ENUM('ACTIVO', 'INACTIVO', 'EGRESADO') NOT NULL DEFAULT 'ACTIVO',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Student_dni_key`(`dni`),
    INDEX `Student_lastName_firstName_idx`(`lastName`, `firstName`),
    INDEX `Student_course_division_idx`(`course`, `division`),
    INDEX `Student_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentGuardian` (
    `studentId` VARCHAR(36) NOT NULL,
    `guardianId` VARCHAR(36) NOT NULL,
    `relation` ENUM('PADRE', 'MADRE', 'TUTOR', 'OTRO') NOT NULL DEFAULT 'OTRO',
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StudentGuardian_guardianId_idx`(`guardianId`),
    PRIMARY KEY (`studentId`, `guardianId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Concept` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `type` ENUM('CUOTA_SOCIAL', 'MATRICULA', 'ACTIVIDAD', 'VIAJE', 'OTRO') NOT NULL DEFAULT 'OTRO',
    `defaultAmount` DECIMAL(12, 2) NOT NULL,
    `recurring` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Concept_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fee` (
    `id` VARCHAR(36) NOT NULL,
    `studentId` VARCHAR(36) NOT NULL,
    `conceptId` VARCHAR(36) NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `surcharge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `dueDate` DATE NOT NULL,
    `status` ENUM('PENDIENTE', 'PARCIAL', 'PAGA', 'ANULADA') NOT NULL DEFAULT 'PENDIENTE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Fee_status_idx`(`status`),
    INDEX `Fee_period_idx`(`period`),
    INDEX `Fee_dueDate_idx`(`dueDate`),
    UNIQUE INDEX `Fee_studentId_conceptId_period_key`(`studentId`, `conceptId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(36) NOT NULL,
    `receiptNumber` VARCHAR(30) NOT NULL,
    `guardianId` VARCHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` ENUM('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'CHEQUE') NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVO', 'ANULADO') NOT NULL DEFAULT 'ACTIVO',
    `createdById` VARCHAR(36) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(36) NULL,
    `cancelReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_receiptNumber_key`(`receiptNumber`),
    INDEX `Payment_date_idx`(`date`),
    INDEX `Payment_guardianId_idx`(`guardianId`),
    INDEX `Payment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAllocation` (
    `id` VARCHAR(36) NOT NULL,
    `paymentId` VARCHAR(36) NOT NULL,
    `feeId` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentAllocation_feeId_idx`(`feeId`),
    UNIQUE INDEX `PaymentAllocation_paymentId_feeId_key`(`paymentId`, `feeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` VARCHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `category` VARCHAR(80) NOT NULL,
    `description` TEXT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'CHEQUE') NOT NULL DEFAULT 'EFECTIVO',
    `reference` VARCHAR(120) NULL,
    `status` ENUM('ACTIVO', 'ANULADO') NOT NULL DEFAULT 'ACTIVO',
    `createdById` VARCHAR(36) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(36) NULL,
    `cancelReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_date_idx`(`date`),
    INDEX `Expense_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashSession` (
    `id` VARCHAR(36) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `openingAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `expectedAmount` DECIMAL(12, 2) NULL,
    `countedAmount` DECIMAL(12, 2) NULL,
    `difference` DECIMAL(12, 2) NULL,
    `status` ENUM('ABIERTA', 'CERRADA') NOT NULL DEFAULT 'ABIERTA',
    `notes` TEXT NULL,
    `openedById` VARCHAR(36) NOT NULL,
    `closedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CashSession_status_idx`(`status`),
    INDEX `CashSession_openedAt_idx`(`openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(80) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sequence` (
    `name` VARCHAR(40) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StudentGuardian` ADD CONSTRAINT `StudentGuardian_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentGuardian` ADD CONSTRAINT `StudentGuardian_guardianId_fkey` FOREIGN KEY (`guardianId`) REFERENCES `Guardian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fee` ADD CONSTRAINT `Fee_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fee` ADD CONSTRAINT `Fee_conceptId_fkey` FOREIGN KEY (`conceptId`) REFERENCES `Concept`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_guardianId_fkey` FOREIGN KEY (`guardianId`) REFERENCES `Guardian`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_feeId_fkey` FOREIGN KEY (`feeId`) REFERENCES `Fee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_openedById_fkey` FOREIGN KEY (`openedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
