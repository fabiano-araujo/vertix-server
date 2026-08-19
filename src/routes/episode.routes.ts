import { FastifyInstance } from 'fastify';
import episodeController from '../controllers/episode.controller';
import { optionalAuth, verifyToken } from '../middlewares/auth';
import { verifyAdmin } from '../middlewares/admin';

export default async function episodeRoutes(fastify: FastifyInstance) {
  // Public routes
  fastify.get('/episodes/:id', {
    preHandler: [optionalAuth],
    handler: episodeController.getEpisode,
  });
  fastify.get('/episodes/:id/next', {
    preHandler: [optionalAuth],
    handler: episodeController.getNextEpisode,
  });

  // Routes that don't require auth but benefit from it
  fastify.post('/episodes/:id/view', episodeController.recordView);

  // Authenticated routes
  fastify.post('/episodes/:id/like', {
    preHandler: [verifyToken],
    handler: episodeController.toggleLike,
  });

  fastify.post('/episodes/:id/progress', {
    preHandler: [verifyToken],
    handler: episodeController.updateProgress,
  });

  fastify.post('/episodes/:id/share', {
    preHandler: [verifyToken],
    handler: episodeController.recordShare,
  });

  fastify.post('/episodes/:id/unlock', {
    preHandler: [verifyToken],
    handler: episodeController.unlockEpisode,
  });

  fastify.post('/episodes/:id/retention', {
    preHandler: [verifyToken],
    handler: episodeController.recordRetention,
  });

  // Admin routes
  fastify.post('/episodes', {
    preHandler: [verifyToken, verifyAdmin],
    handler: episodeController.createEpisode,
  });

  fastify.put('/episodes/:id', {
    preHandler: [verifyToken, verifyAdmin],
    handler: episodeController.updateEpisode,
  });

  fastify.delete('/episodes/:id', {
    preHandler: [verifyToken, verifyAdmin],
    handler: episodeController.deleteEpisode,
  });
}
