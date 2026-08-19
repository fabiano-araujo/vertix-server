import { FastifyRequest, FastifyReply } from 'fastify';
import recommendationService from '../services/recommendation.service';
import * as watchHistoryRepository from '../repositories/watch-history.repository';
import { decorateEpisodesForViewer } from '../services/episode-paywall.service';

const viewerId = (req: FastifyRequest): number | undefined => {
  const id = Number((req as any).user?.id);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

// ============================================
// FOR YOU FEED (Personalized)
// ============================================

export const getForYouFeed = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    const episodes = await recommendationService.getPersonalizedFeed(user.id, limit, offset);
    const decorated = await decorateEpisodesForViewer(episodes, user.id);

    return reply.send({
      success: true,
      data: decorated,
      pagination: {
        limit,
        offset,
        hasMore: episodes.length === limit,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting for-you feed:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar feed personalizado',
    });
  }
};

// ============================================
// TRENDING FEED
// ============================================

export const getTrendingFeed = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    const episodes = await recommendationService.getTrendingFeed(limit, offset);
    const decorated = await decorateEpisodesForViewer(episodes, viewerId(req));

    return reply.send({
      success: true,
      data: decorated,
      pagination: {
        limit,
        offset,
        hasMore: episodes.length === limit,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting trending feed:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar feed em alta',
    });
  }
};

// ============================================
// NEW RELEASES FEED
// ============================================

export const getNewReleasesFeed = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    const episodes = await recommendationService.getNewReleases(limit, offset);
    const decorated = await decorateEpisodesForViewer(episodes, viewerId(req));

    return reply.send({
      success: true,
      data: decorated,
      pagination: {
        limit,
        offset,
        hasMore: episodes.length === limit,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting new releases:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar novidades',
    });
  }
};

// ============================================
// GENRE FEED
// ============================================

export const getGenreFeed = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { genre } = req.params as { genre: string };
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    const episodes = await recommendationService.getByGenre(genre, limit, offset);
    const decorated = await decorateEpisodesForViewer(episodes, viewerId(req));

    return reply.send({
      success: true,
      data: decorated,
      pagination: {
        limit,
        offset,
        hasMore: episodes.length === limit,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting genre feed:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar feed por genero',
    });
  }
};

// ============================================
// HOME CAROUSELS
// ============================================

export const getHomeCarousels = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;

    const carousels = await recommendationService.getHomeCarousels(userId);

    // If user is logged in, add continue watching
    let continueWatching: any[] = [];
    if (userId) {
      const rows = await watchHistoryRepository.getContinueWatching(userId, 10);
      const decoratedEpisodes = await decorateEpisodesForViewer(
        rows.map((item: any) => ({
          ...(item.episode || {}),
          seriesId: item.episode?.seriesId || item.episode?.series?.id,
          watchProgress: item.progress,
        })),
        userId,
      );
      continueWatching = rows.map((item: any, index: number) => ({
        ...item,
        episode: decoratedEpisodes[index] || item.episode,
      }));
    }

    return reply.send({
      success: true,
      data: {
        continueWatching,
        trending: carousels.trending,
        newReleases: carousels.newReleases,
        recommended: carousels.recommended,
        byGenre: carousels.byGenre,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting home carousels:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar carroseis',
    });
  }
};

// ============================================
// CONTINUE WATCHING
// ============================================

export const getContinueWatching = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const query = req.query as any;
    const limit = parseInt(query.limit) || 10;

    const episodes = await watchHistoryRepository.getContinueWatching(user.id, limit);
    const decoratedEpisodes = await decorateEpisodesForViewer(
      episodes.map((item: any) => ({
        ...(item.episode || {}),
        seriesId: item.episode?.seriesId || item.episode?.series?.id,
        watchProgress: item.progress,
      })),
      user.id,
    );

    return reply.send({
      success: true,
      data: episodes.map((item: any, index: number) => ({
        ...item,
        episode: decoratedEpisodes[index] || item.episode,
      })),
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting continue watching:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar continuar assistindo',
    });
  }
};

// ============================================
// WATCH HISTORY
// ============================================

export const getWatchHistory = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    const result = await watchHistoryRepository.getWatchHistory(user.id, limit, offset);

    return reply.send({
      success: true,
      data: result.history,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: offset + result.history.length < result.total,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting watch history:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar historico',
    });
  }
};

// ============================================
// USER LIKES
// ============================================

export const getUserLikes = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const [likes, total] = await Promise.all([
      prisma.episodeLike.findMany({
        where: { userId: user.id },
        include: {
          episode: {
            include: {
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
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.episodeLike.count({ where: { userId: user.id } }),
    ]);

    await prisma.$disconnect();

    const decorated = await decorateEpisodesForViewer(
      likes.map((l: any) => l.episode),
      user.id,
    );

    return reply.send({
      success: true,
      data: decorated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + likes.length < total,
      },
    });
  } catch (error: any) {
    console.error('[Feed Controller] Error getting user likes:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar curtidas',
    });
  }
};

export default {
  getForYouFeed,
  getTrendingFeed,
  getNewReleasesFeed,
  getGenreFeed,
  getHomeCarousels,
  getContinueWatching,
  getWatchHistory,
  getUserLikes,
};
