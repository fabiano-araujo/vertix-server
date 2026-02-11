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
