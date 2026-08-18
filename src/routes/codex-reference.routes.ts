import { FastifyInstance } from 'fastify';

import controller from '../controllers/codex-reference.controller';

export default async function codexReferenceRoutes(fastify: FastifyInstance) {
  fastify.get('/codex/reference-image-jobs/:id', {
    handler: controller.getManifest,
  });

  fastify.post('/codex/reference-image-jobs/:id/items/:referenceId/status', {
    bodyLimit: 64 * 1024,
    handler: controller.updateItemStatus,
  });

  fastify.post('/codex/reference-image-jobs/:id/items/:referenceId/upload', {
    bodyLimit: 30 * 1024 * 1024,
    handler: controller.uploadItem,
  });

  fastify.post('/codex/reference-image-jobs/:id/complete', {
    bodyLimit: 16 * 1024,
    handler: controller.completeJob,
  });
}
