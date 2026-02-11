import prisma from '../services/prisma';

// ============================================
// TYPES
// ============================================

export interface UpdateWatchProgressData {
  userId: number;
  episodeId: number;
  progress: number; // 0.0 to 1.0
  watchTime?: number; // in seconds
}

// ============================================
// CREATE / UPDATE PROGRESS
// ============================================

export const updateWatchProgress = async (data: UpdateWatchProgressData) => {
  const { userId, episodeId, progress, watchTime } = data;

  console.log(`[WatchHistory] Updating progress for user ${userId}, episode ${episodeId}: ${progress}`);

  const completedAt = progress >= 0.9 ? new Date() : null;

  return prisma.watchHistory.upsert({
    where: {
      userId_episodeId: { userId, episodeId },
    },
    update: {
      progress,
      watchTime: watchTime ? { increment: watchTime } : undefined,
      lastWatchedAt: new Date(),
      completedAt: completedAt || undefined,
    },
    create: {
      userId,
      episodeId,
      progress,
      watchTime: watchTime || 0,
      lastWatchedAt: new Date(),
      completedAt,
    },
    include: {
      episode: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          series: {
            select: {
              id: true,
              title: true,
              genre: true,
            },
          },
        },
      },
    },
  });
};

// ============================================
// READ
// ============================================

export const getWatchProgress = async (userId: number, episodeId: number) => {
  return prisma.watchHistory.findUnique({
    where: {
      userId_episodeId: { userId, episodeId },
    },
  });
};

export const getContinueWatching = async (userId: number, limit: number = 10) => {
  return prisma.watchHistory.findMany({
    where: {
      userId,
      progress: {
        gt: 0.05, // Started watching (more than 5%)
        lt: 0.9, // Not finished (less than 90%)
      },
    },
    include: {
      episode: {
        select: {
          id: true,
          episodeNumber: true,
          title: true,
          thumbnailUrl: true,
          videoUrl: true,
          duration: true,
          series: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              genre: true,
              totalEpisodes: true,
            },
          },
        },
      },
    },
    orderBy: { lastWatchedAt: 'desc' },
    take: limit,
  });
};

export const getWatchHistory = async (
  userId: number,
  limit: number = 20,
  offset: number = 0
) => {
  const [history, total] = await Promise.all([
    prisma.watchHistory.findMany({
      where: { userId },
      include: {
        episode: {
          select: {
            id: true,
            episodeNumber: true,
            title: true,
            thumbnailUrl: true,
            duration: true,
            series: {
              select: {
                id: true,
                title: true,
                coverUrl: true,
              },
            },
          },
        },
      },
      orderBy: { lastWatchedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.watchHistory.count({ where: { userId } }),
  ]);

  return { history, total, limit, offset };
};

export const getCompletedEpisodes = async (userId: number, limit: number = 20) => {
  return prisma.watchHistory.findMany({
    where: {
      userId,
      progress: { gte: 0.9 },
    },
    include: {
      episode: {
        select: {
          id: true,
          episodeNumber: true,
          title: true,
          thumbnailUrl: true,
          series: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: limit,
  });
};

export const getSeriesProgress = async (userId: number, seriesId: number) => {
  const episodes = await prisma.episode.findMany({
    where: { seriesId },
    select: { id: true },
  });

  const episodeIds = episodes.map(e => e.id);

  const watchHistory = await prisma.watchHistory.findMany({
    where: {
      userId,
      episodeId: { in: episodeIds },
    },
    select: {
      episodeId: true,
      progress: true,
      completedAt: true,
    },
  });

  const completedCount = watchHistory.filter(w => w.progress >= 0.9).length;
  const inProgressCount = watchHistory.filter(w => w.progress > 0.05 && w.progress < 0.9).length;

  return {
    totalEpisodes: episodes.length,
    completedEpisodes: completedCount,
    inProgressEpisodes: inProgressCount,
    progressPercentage: episodes.length > 0 ? (completedCount / episodes.length) * 100 : 0,
    episodeProgress: watchHistory,
  };
};

// ============================================
// DELETE
// ============================================

export const clearWatchProgress = async (userId: number, episodeId: number) => {
  return prisma.watchHistory.delete({
    where: {
      userId_episodeId: { userId, episodeId },
    },
  });
};

export const clearAllHistory = async (userId: number) => {
  return prisma.watchHistory.deleteMany({
    where: { userId },
  });
};

// ============================================
// ANALYTICS
// ============================================

export const getTotalWatchTime = async (userId: number): Promise<number> => {
  const result = await prisma.watchHistory.aggregate({
    where: { userId },
    _sum: { watchTime: true },
  });

  return result._sum.watchTime || 0;
};

export const getMostWatchedGenres = async (userId: number, limit: number = 5) => {
  const history = await prisma.watchHistory.findMany({
    where: { userId },
    include: {
      episode: {
        select: {
          series: {
            select: { genre: true },
          },
        },
      },
    },
  });

  // Count genres
  const genreCounts: { [genre: string]: number } = {};
  for (const item of history) {
    const genre = item.episode.series.genre.toLowerCase();
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  }

  // Sort and return top genres
  return Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([genre, count]) => ({ genre, count }));
};

// ============================================
// EXPORTS
// ============================================

export default {
  updateWatchProgress,
  getWatchProgress,
  getContinueWatching,
  getWatchHistory,
  getCompletedEpisodes,
  getSeriesProgress,
  clearWatchProgress,
  clearAllHistory,
  getTotalWatchTime,
  getMostWatchedGenres,
};
