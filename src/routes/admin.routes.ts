import { FastifyInstance } from 'fastify';
import adminController from '../controllers/admin.controller';
import { verifyToken } from '../middlewares/auth';
import { verifyAdmin } from '../middlewares/admin';

export default async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require authentication and admin role
  const preHandler = [verifyToken, verifyAdmin];

  // AI Generation
  fastify.post('/admin/series/generate', {
    preHandler,
    handler: adminController.generateSeries,
  });

  fastify.post('/admin/codex/jobs', {
    preHandler,
    bodyLimit: 10 * 1024 * 1024,
    handler: adminController.startCodexWorkflow,
  });

  fastify.post('/admin/series', {
    preHandler,
    handler: adminController.createSeries,
  });

  fastify.get('/admin/series/available', {
    preHandler,
    handler: adminController.listAvailableSeries,
  });

  fastify.get('/admin/series/:id/production', {
    preHandler,
    handler: adminController.getSeriesProduction,
  });

  fastify.post('/admin/series/:id/production', {
    preHandler,
    bodyLimit: 30 * 1024 * 1024,
    handler: adminController.saveSeriesProduction,
  });

  fastify.post('/admin/series/:id/catalog-assets', {
    preHandler,
    bodyLimit: 30 * 1024 * 1024,
    handler: adminController.syncSeriesCatalogAssets,
  });

  fastify.post('/admin/series/:id/references', {
    preHandler,
    bodyLimit: 30 * 1024 * 1024,
    handler: adminController.ingestSeriesReference,
  });

  fastify.post('/admin/series/:id/production/upload-url', {
    preHandler,
    handler: adminController.getSeriesProductionUploadUrl,
  });

  // Jobs
  fastify.get('/admin/jobs', {
    preHandler,
    handler: adminController.getJobs,
  });

  fastify.get('/admin/jobs/:id', {
    preHandler,
    handler: adminController.getJobStatus,
  });

  fastify.delete('/admin/jobs/:id', {
    preHandler,
    handler: adminController.cancelJob,
  });

  // Analytics
  fastify.get('/admin/analytics', {
    preHandler,
    handler: adminController.getAnalytics,
  });

  // User Management
  fastify.get('/admin/users', {
    preHandler,
    handler: adminController.listUsers,
  });

  fastify.put('/admin/users/:id/role', {
    preHandler,
    handler: adminController.updateUserRole,
  });
}
