import { FastifyInstance } from 'fastify';
import feedController from '../controllers/feed.controller';
import { optionalAuth, verifyToken } from '../middlewares/auth';

export default async function feedRoutes(fastify: FastifyInstance) {
  // Public routes
  fastify.get('/feed/trending', {
    preHandler: [optionalAuth],
    handler: feedController.getTrendingFeed,
  });
  fastify.get('/feed/new', {
    preHandler: [optionalAuth],
    handler: feedController.getNewReleasesFeed,
  });
  fastify.get('/feed/genre/:genre', {
    preHandler: [optionalAuth],
    handler: feedController.getGenreFeed,
  });

  // Routes that work with optional auth
  fastify.get('/feed/home', {
    preHandler: [optionalAuth],
    handler: feedController.getHomeCarousels,
  });

  // Authenticated routes
  fastify.get('/feed/for-you', {
    preHandler: [verifyToken],
    handler: feedController.getForYouFeed,
  });

  fastify.get('/feed/continue-watching', {
    preHandler: [verifyToken],
    handler: feedController.getContinueWatching,
  });

  fastify.get('/feed/history', {
    preHandler: [verifyToken],
    handler: feedController.getWatchHistory,
  });

  fastify.get('/feed/likes', {
    preHandler: [verifyToken],
    handler: feedController.getUserLikes,
  });
}
