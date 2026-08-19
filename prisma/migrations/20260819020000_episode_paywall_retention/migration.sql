-- AlterTable
ALTER TABLE `Series` ADD COLUMN `freeEpisodeCount` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Series` ADD COLUMN `episodeUnlockCost` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `EpisodeUnlock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `episodeId` INTEGER NOT NULL,
    `seriesId` INTEGER NOT NULL,
    `creditsSpent` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EpisodeUnlock_userId_episodeId_key`(`userId`, `episodeId`),
    INDEX `EpisodeUnlock_userId_seriesId_idx`(`userId`, `seriesId`),
    INDEX `EpisodeUnlock_episodeId_idx`(`episodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WatchRetentionEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `episodeId` INTEGER NOT NULL,
    `seriesId` INTEGER NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `positionSeconds` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WatchRetentionEvent_episodeId_event_createdAt_idx`(`episodeId`, `event`, `createdAt`),
    INDEX `WatchRetentionEvent_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `WatchRetentionEvent_seriesId_event_createdAt_idx`(`seriesId`, `event`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EpisodeUnlock` ADD CONSTRAINT `EpisodeUnlock_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EpisodeUnlock` ADD CONSTRAINT `EpisodeUnlock_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `Episode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EpisodeUnlock` ADD CONSTRAINT `EpisodeUnlock_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchRetentionEvent` ADD CONSTRAINT `WatchRetentionEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WatchRetentionEvent` ADD CONSTRAINT `WatchRetentionEvent_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `Episode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WatchRetentionEvent` ADD CONSTRAINT `WatchRetentionEvent_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
