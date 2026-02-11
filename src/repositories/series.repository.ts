import prisma from '../services/prisma';

// ============================================
// TYPES
// ============================================

export interface CreateSeriesData {
  title: string;
  description: string;
  coverUrl: string;
  thumbnailUrl?: string;
  genre: string;
  tags?: string;
  totalEpisodes?: number;
  createdById: number;
  status?: string;
  isAiGenerated?: boolean;
}

export interface UpdateSeriesData {
  title?: string;
  description?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  genre?: string;
  tags?: string;
  totalEpisodes?: number;
  status?: string;
  hypeScore?: number;
  trendingScore?: number;
}

export interface SeriesFilters {
  genre?: string;
  status?: string;
  createdById?: number;
  isAiGenerated?: boolean;
  search?: string;
}

// ============================================
// CREATE
// ============================================

export const createSeries = async (data: CreateSeriesData) => {
  console.log('[Series Repository] Creating series:', data.title);

  return prisma.series.create({
    data: {
      title: data.title,
      description: data.description,
      coverUrl: data.coverUrl,
      thumbnailUrl: data.thumbnailUrl,
      genre: data.genre,
      tags: data.tags,
      totalEpisodes: data.totalEpisodes || 0,
      createdById: data.createdById,
      status: data.status || 'DRAFT',
      isAiGenerated: data.isAiGenerated || false,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
      _count: {
        select: { episodes: true },
      },
    },
  });
};

// ============================================
// READ
// ============================================

export const findSeriesById = async (id: number) => {
  return prisma.series.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        select: {
          id: true,
          episodeNumber: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          views: true,
          likesCount: true,
        },
      },
      _count: {
        select: { episodes: true },
      },
    },
  });
};

export const findAllSeries = async (
  filters: SeriesFilters = {},
  limit: number = 20,
  offset: number = 0
) => {
  const where: any = {};

  if (filters.genre) {
    where.genre = { contains: filters.genre };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.createdById) {
    where.createdById = filters.createdById;
  }

  if (filters.isAiGenerated !== undefined) {
    where.isAiGenerated = filters.isAiGenerated;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
      { tags: { contains: filters.search } },
    ];
  }

  const [series, total] = await Promise.all([
    prisma.series.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
            photo: true,
          },
        },
        _count: {
          select: { episodes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.series.count({ where }),
  ]);

  return { series, total, limit, offset };
};

export const findPublishedSeries = async (limit: number = 20, offset: number = 0) => {
  return findAllSeries({ status: 'PUBLISHED' }, limit, offset);
};

export const findSeriesByGenre = async (genre: string, limit: number = 20, offset: number = 0) => {
  return findAllSeries({ status: 'PUBLISHED', genre }, limit, offset);
};

export const findTrendingSeries = async (limit: number = 10) => {
  return prisma.series.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      _count: {
        select: { episodes: true },
      },
    },
    orderBy: { trendingScore: 'desc' },
    take: limit,
  });
};

export const findNewSeries = async (limit: number = 10) => {
  return prisma.series.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      _count: {
        select: { episodes: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

// ============================================
// UPDATE
// ============================================

export const updateSeries = async (id: number, data: UpdateSeriesData) => {
  console.log('[Series Repository] Updating series:', id);

  return prisma.series.update({
    where: { id },
    data,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
      _count: {
        select: { episodes: true },
      },
    },
  });
};

export const publishSeries = async (id: number) => {
  return updateSeries(id, { status: 'PUBLISHED' });
};

export const archiveSeries = async (id: number) => {
  return updateSeries(id, { status: 'ARCHIVED' });
};

export const incrementEpisodeCount = async (id: number) => {
  return prisma.series.update({
    where: { id },
    data: {
      totalEpisodes: { increment: 1 },
    },
  });
};

// ============================================
// DELETE
// ============================================

export const deleteSeries = async (id: number) => {
  console.log('[Series Repository] Deleting series:', id);

  // Episodes will be cascade deleted due to onDelete: Cascade in schema
  return prisma.series.delete({
    where: { id },
  });
};

// ============================================
// EXPORTS
// ============================================

export default {
  createSeries,
  findSeriesById,
  findAllSeries,
  findPublishedSeries,
  findSeriesByGenre,
  findTrendingSeries,
  findNewSeries,
  updateSeries,
  publishSeries,
  archiveSeries,
  incrementEpisodeCount,
  deleteSeries,
};
