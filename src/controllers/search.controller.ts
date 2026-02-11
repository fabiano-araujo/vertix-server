import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/prisma';

// ============================================
// SEARCH
// ============================================

export const search = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const searchTerm = query.q || '';
    const genre = query.genre;
    const type = query.type || 'all'; // 'all', 'series', 'episodes'
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    if (!searchTerm && !genre) {
      return reply.code(400).send({
        success: false,
        message: 'Informe um termo de busca ou genero',
      });
    }

    let series: any[] = [];
    let episodes: any[] = [];
    let totalSeries = 0;
    let totalEpisodes = 0;

    // Build search conditions
    const searchCondition = searchTerm
      ? {
          OR: [
            { title: { contains: searchTerm } },
            { description: { contains: searchTerm } },
          ],
        }
      : {};

    const genreCondition = genre ? { genre: { contains: genre } } : {};

    // Search series
    if (type === 'all' || type === 'series') {
      const [seriesResult, seriesCount] = await Promise.all([
        prisma.series.findMany({
          where: {
            status: 'PUBLISHED',
            ...searchCondition,
            ...genreCondition,
          },
          include: {
            _count: {
              select: { episodes: true },
            },
          },
          orderBy: [{ trendingScore: 'desc' }, { createdAt: 'desc' }],
          skip: type === 'series' ? offset : 0,
          take: type === 'series' ? limit : 10,
        }),
        prisma.series.count({
          where: {
            status: 'PUBLISHED',
            ...searchCondition,
            ...genreCondition,
          },
        }),
      ]);

      series = seriesResult;
      totalSeries = seriesCount;
    }

    // Search episodes
    if (type === 'all' || type === 'episodes') {
      const episodeSearchCondition = searchTerm
        ? {
            OR: [
              { title: { contains: searchTerm } },
              { description: { contains: searchTerm } },
              { series: { title: { contains: searchTerm } } },
            ],
          }
        : {};

      const episodeGenreCondition = genre
        ? { series: { genre: { contains: genre } } }
        : {};

      const [episodesResult, episodesCount] = await Promise.all([
        prisma.episode.findMany({
          where: {
            series: { status: 'PUBLISHED' },
            ...episodeSearchCondition,
            ...episodeGenreCondition,
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
          orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
          skip: type === 'episodes' ? offset : 0,
          take: type === 'episodes' ? limit : 10,
        }),
        prisma.episode.count({
          where: {
            series: { status: 'PUBLISHED' },
            ...episodeSearchCondition,
            ...episodeGenreCondition,
          },
        }),
      ]);

      episodes = episodesResult;
      totalEpisodes = episodesCount;
    }

    return reply.send({
      success: true,
      data: {
        series,
        episodes,
      },
      pagination: {
        series: {
          total: totalSeries,
          returned: series.length,
        },
        episodes: {
          total: totalEpisodes,
          returned: episodes.length,
        },
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[Search Controller] Error searching:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar',
    });
  }
};

// ============================================
// SEARCH SUGGESTIONS
// ============================================

export const getSuggestions = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const searchTerm = query.q || '';
    const limit = parseInt(query.limit) || 10;

    if (searchTerm.length < 2) {
      return reply.send({
        success: true,
        data: [],
      });
    }

    // Get series title suggestions
    const seriesSuggestions = await prisma.series.findMany({
      where: {
        status: 'PUBLISHED',
        title: { contains: searchTerm },
      },
      select: {
        id: true,
        title: true,
        genre: true,
        coverUrl: true,
      },
      take: limit,
      orderBy: { trendingScore: 'desc' },
    });

    return reply.send({
      success: true,
      data: seriesSuggestions.map((s) => ({
        id: s.id,
        type: 'series',
        title: s.title,
        subtitle: s.genre,
        image: s.coverUrl,
      })),
    });
  } catch (error: any) {
    console.error('[Search Controller] Error getting suggestions:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar sugestoes',
    });
  }
};

// ============================================
// TRENDING SEARCHES
// ============================================

export const getTrendingSearches = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const limit = parseInt((req.query as any).limit) || 10;

    // Get trending series as search suggestions
    const trending = await prisma.series.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        genre: true,
      },
      orderBy: { trendingScore: 'desc' },
      take: limit,
    });

    return reply.send({
      success: true,
      data: trending.map((s) => ({
        term: s.title,
        genre: s.genre,
      })),
    });
  } catch (error: any) {
    console.error('[Search Controller] Error getting trending searches:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar tendencias',
    });
  }
};

// ============================================
// GET GENRES
// ============================================

export const getGenres = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Get distinct genres from published series
    const series = await prisma.series.findMany({
      where: { status: 'PUBLISHED' },
      select: { genre: true },
      distinct: ['genre'],
    });

    const genres = series.map((s) => s.genre).filter(Boolean);

    // Predefined genres with labels
    const genreLabels: { [key: string]: string } = {
      acao: 'Acao',
      aventura: 'Aventura',
      comedia: 'Comedia',
      drama: 'Drama',
      fantasia: 'Fantasia',
      ficcao: 'Ficcao Cientifica',
      horror: 'Horror',
      misterio: 'Misterio',
      romance: 'Romance',
      suspense: 'Suspense',
      terror: 'Terror',
      thriller: 'Thriller',
      animacao: 'Animacao',
      documentario: 'Documentario',
      musical: 'Musical',
    };

    const genresWithLabels = genres.map((genre) => ({
      id: genre.toLowerCase(),
      name: genreLabels[genre.toLowerCase()] || genre,
    }));

    return reply.send({
      success: true,
      data: genresWithLabels,
    });
  } catch (error: any) {
    console.error('[Search Controller] Error getting genres:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar generos',
    });
  }
};

export default {
  search,
  getSuggestions,
  getTrendingSearches,
  getGenres,
};
