import { FastifyInstance } from 'fastify';
import seriesController from '../controllers/series.controller';
import { verifyToken } from '../middlewares/auth';
import { verifyAdmin } from '../middlewares/admin';

export default async function seriesRoutes(fastify: FastifyInstance) {
  // Public routes
  fastify.get('/series', seriesController.listSeries);
  fastify.get('/series/trending', seriesController.getTrendingSeries);
  fastify.get('/series/new', seriesController.getNewSeries);
  fastify.get('/series/:id', seriesController.getSeriesById);
  fastify.get('/series/:id/episodes', seriesController.getSeriesEpisodes);

  // Admin routes
  fastify.post('/series', {
    preHandler: [verifyToken, verifyAdmin],
    handler: seriesController.createSeries,
  });

  fastify.put('/series/:id', {
    preHandler: [verifyToken, verifyAdmin],
    handler: seriesController.updateSeries,
  });

  fastify.delete('/series/:id', {
    preHandler: [verifyToken, verifyAdmin],
    handler: seriesController.deleteSeries,
  });

  fastify.post('/series/:id/publish', {
    preHandler: [verifyToken, verifyAdmin],
    handler: seriesController.publishSeries,
  });
}
