import prisma from '../services/prisma';

// ============================================
// TYPES
// ============================================

export interface CreateEpisodeData {
  seriesId: number;
  episodeNumber: number;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
}

export interface UpdateEpisodeData {
  title?: string;
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
}

// ============================================
// CREATE
// ============================================

export const createEpisode = async (data: CreateEpisodeData) => {
  console.log('[Episode Repository] Creating episode:', data.title);

  const episode = await prisma.episode.create({
    data: {
      seriesId: data.seriesId,
      episodeNumber: data.episodeNumber,
      title: data.title,
      description: data.description,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration,
    },
    include: {
      series: {
        select: {
          id: true,
          title: true,
          genre: true,
          coverUrl: true,
        },
      },
    },
  });

  // Update series episode count
  await prisma.series.update({
    where: { id: data.seriesId },
    data: { totalEpisodes: { increment: 1 } },
  });

  return episode;
};

// ============================================
// READ
// ============================================

export const findEpisodeById = async (id: number) => {
  return prisma.episode.findUnique({
    where: { id },
    include: {
      series: {
        select: {
          id: true,
          title: true,
          description: true,
          genre: true,
          coverUrl: true,
          createdById: true,
          totalEpisodes: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  });
};

export const findEpisodesBySeriesId = async (seriesId: number) => {
  return prisma.episode.findMany({
    where: { seriesId },
    orderBy: { episodeNumber: 'asc' },
    include: {
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  });
};

export const findEpisodeBySeriesAndNumber = async (seriesId: number, episodeNumber: number) => {
  return prisma.episode.findUnique({
    where: {
      seriesId_episodeNumber: {
        seriesId,
        episodeNumber,
      },
    },
    include: {
      series: {
        select: {
          id: true,
          title: true,
          genre: true,
          coverUrl: true,
          totalEpisodes: true,
        },
      },
    },
  });
};

export const findNextEpisode = async (seriesId: number, currentEpisodeNumber: number) => {
  return prisma.episode.findFirst({
    where: {
      seriesId,
      episodeNumber: { gt: currentEpisodeNumber },
    },
    orderBy: { episodeNumber: 'asc' },
  });
};

export const findPreviousEpisode = async (seriesId: number, currentEpisodeNumber: number) => {
  return prisma.episode.findFirst({
    where: {
      seriesId,
      episodeNumber: { lt: currentEpisodeNumber },
    },
    orderBy: { episodeNumber: 'desc' },
  });
};

// ============================================
// UPDATE
// ============================================

export const updateEpisode = async (id: number, data: UpdateEpisodeData) => {
  console.log('[Episode Repository] Updating episode:', id);

  return prisma.episode.update({
    where: { id },
    data,
    include: {
      series: {
        select: {
          id: true,
          title: true,
          genre: true,
        },
      },
    },
  });
};

// ============================================
// INTERACTIONS
// ============================================

export const incrementViews = async (id: number) => {
  return prisma.episode.update({
    where: { id },
    data: { views: { increment: 1 } },
  });
};

export const incrementLikes = async (id: number) => {
  return prisma.episode.update({
    where: { id },
    data: { likesCount: { increment: 1 } },
  });
};

export const decrementLikes = async (id: number) => {
  return prisma.episode.update({
    where: { id },
    data: { likesCount: { decrement: 1 } },
  });
};

export const incrementComments = async (id: number) => {
  return prisma.episode.update({
    where: { id },
    data: { commentsCount: { increment: 1 } },
  });
};

export const decrementComments = async (id: number) => {
  return prisma.episode.update({
    where: { id },
    data: { commentsCount: { decrement: 1 } },
  });
};

export const incrementShares = async (id: number) => {
  return prisma.episode.update({
    where: { id },
    data: { sharesCount: { increment: 1 } },
  });
};

export const updateCompletionRate = async (id: number, newRate: number) => {
  // Get current rate and calculate weighted average
  const episode = await prisma.episode.findUnique({
    where: { id },
    select: { completionRate: true, views: true },
  });

  if (!episode) return null;

  // Weighted average: (currentRate * views + newRate) / (views + 1)
  const weightedRate =
    episode.views > 0
      ? (episode.completionRate * episode.views + newRate) / (episode.views + 1)
      : newRate;

  return prisma.episode.update({
    where: { id },
    data: { completionRate: weightedRate },
  });
};

// ============================================
// LIKES
// ============================================

export const toggleLike = async (episodeId: number, userId: number): Promise<boolean> => {
  const existingLike = await prisma.episodeLike.findUnique({
    where: {
      userId_episodeId: { userId, episodeId },
    },
  });

  if (existingLike) {
    // Remove like
    await prisma.episodeLike.delete({
      where: { id: existingLike.id },
    });
    await decrementLikes(episodeId);
    return false;
  } else {
    // Add like
    await prisma.episodeLike.create({
      data: { userId, episodeId },
    });
    await incrementLikes(episodeId);
    return true;
  }
};

export const hasUserLiked = async (episodeId: number, userId: number): Promise<boolean> => {
  const like = await prisma.episodeLike.findUnique({
    where: {
      userId_episodeId: { userId, episodeId },
    },
  });
  return !!like;
};

export const getEpisodeLikes = async (episodeId: number, limit: number = 20, offset: number = 0) => {
  return prisma.episodeLike.findMany({
    where: { episodeId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });
};

// ============================================
// DELETE
// ============================================

export const deleteEpisode = async (id: number) => {
  console.log('[Episode Repository] Deleting episode:', id);

  const episode = await prisma.episode.findUnique({
    where: { id },
    select: { seriesId: true },
  });

  if (!episode) return null;

  // Delete episode
  await prisma.episode.delete({
    where: { id },
  });

  // Update series episode count
  await prisma.series.update({
    where: { id: episode.seriesId },
    data: { totalEpisodes: { decrement: 1 } },
  });

  return { deleted: true };
};

// ============================================
// EXPORTS
// ============================================

export default {
  createEpisode,
  findEpisodeById,
  findEpisodesBySeriesId,
  findEpisodeBySeriesAndNumber,
  findNextEpisode,
  findPreviousEpisode,
  updateEpisode,
  incrementViews,
  incrementLikes,
  decrementLikes,
  incrementComments,
  decrementComments,
  incrementShares,
  updateCompletionRate,
  toggleLike,
  hasUserLiked,
  getEpisodeLikes,
  deleteEpisode,
};
