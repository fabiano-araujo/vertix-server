-- CreateTable
CREATE TABLE `SeriesProductionPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `seriesId` INTEGER NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'seedance-series-pipeline',
    `seriesBible` LONGTEXT NULL,
    `characterBible` LONGTEXT NULL,
    `locationBible` LONGTEXT NULL,
    `objectBible` LONGTEXT NULL,
    `spatialMaps` LONGTEXT NULL,
    `audioBible` LONGTEXT NULL,
    `seasonArc` LONGTEXT NULL,
    `episodeMap` LONGTEXT NULL,
    `episodeTreatments` LONGTEXT NULL,
    `sceneCards` LONGTEXT NULL,
    `storyboardPlan` LONGTEXT NULL,
    `generationPlan` LONGTEXT NULL,
    `seedanceNotes` LONGTEXT NULL,
    `rawPayload` LONGTEXT NULL,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SeriesProductionPlan_seriesId_key`(`seriesId`),
    INDEX `SeriesProductionPlan_createdById_idx`(`createdById`),
    INDEX `SeriesProductionPlan_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeriesReferenceAsset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `seriesId` INTEGER NOT NULL,
    `episodeId` INTEGER NULL,
    `productionPlanId` INTEGER NULL,
    `category` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sourceUrl` TEXT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `publicUrl` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `prompt` LONGTEXT NULL,
    `metadata` LONGTEXT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SeriesReferenceAsset_seriesId_category_idx`(`seriesId`, `category`),
    INDEX `SeriesReferenceAsset_episodeId_idx`(`episodeId`),
    INDEX `SeriesReferenceAsset_productionPlanId_idx`(`productionPlanId`),
    INDEX `SeriesReferenceAsset_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeriesStoryPoint` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `seriesId` INTEGER NOT NULL,
    `episodeId` INTEGER NULL,
    `productionPlanId` INTEGER NULL,
    `pointType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `episodeNumber` INTEGER NULL,
    `sceneNumber` INTEGER NULL,
    `segment` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `metadata` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SeriesStoryPoint_seriesId_pointType_idx`(`seriesId`, `pointType`),
    INDEX `SeriesStoryPoint_episodeId_idx`(`episodeId`),
    INDEX `SeriesStoryPoint_productionPlanId_idx`(`productionPlanId`),
    INDEX `SeriesStoryPoint_orderIndex_idx`(`orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SeriesProductionPlan` ADD CONSTRAINT `SeriesProductionPlan_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesReferenceAsset` ADD CONSTRAINT `SeriesReferenceAsset_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesReferenceAsset` ADD CONSTRAINT `SeriesReferenceAsset_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `Episode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesReferenceAsset` ADD CONSTRAINT `SeriesReferenceAsset_productionPlanId_fkey` FOREIGN KEY (`productionPlanId`) REFERENCES `SeriesProductionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesStoryPoint` ADD CONSTRAINT `SeriesStoryPoint_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesStoryPoint` ADD CONSTRAINT `SeriesStoryPoint_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `Episode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesStoryPoint` ADD CONSTRAINT `SeriesStoryPoint_productionPlanId_fkey` FOREIGN KEY (`productionPlanId`) REFERENCES `SeriesProductionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
