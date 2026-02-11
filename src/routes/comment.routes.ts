import { FastifyInstance } from 'fastify';
import commentController from '../controllers/comment.controller';
import { verifyToken } from '../middlewares/auth';
import { verifyAdmin } from '../middlewares/admin';

export default async function commentRoutes(fastify: FastifyInstance) {
  // Public routes (with optional auth for like status)
  fastify.get('/episodes/:episodeId/comments', {
    preHandler: async (req, reply) => {
      // Optional auth
      try {
        await verifyToken(req, reply);
      } catch {
        // Continue without auth
      }
    },
    handler: commentController.getEpisodeComments,
  });

  fastify.get('/comments/:commentId/replies', {
    preHandler: async (req, reply) => {
      try {
        await verifyToken(req, reply);
      } catch {
        // Continue without auth
      }
    },
    handler: commentController.getCommentReplies,
  });

  // Authenticated routes
  fastify.post('/comments', {
    preHandler: [verifyToken],
    handler: commentController.createComment,
  });

  fastify.put('/comments/:id', {
    preHandler: [verifyToken],
    handler: commentController.updateComment,
  });

  fastify.delete('/comments/:id', {
    preHandler: [verifyToken],
    handler: commentController.deleteComment,
  });

  fastify.post('/comments/:id/like', {
    preHandler: [verifyToken],
    handler: commentController.toggleCommentLike,
  });

  // Admin routes
  fastify.post('/comments/:id/pin', {
    preHandler: [verifyToken, verifyAdmin],
    handler: commentController.pinComment,
  });

  fastify.delete('/comments/:id/pin', {
    preHandler: [verifyToken, verifyAdmin],
    handler: commentController.unpinComment,
  });

  fastify.post('/comments/:id/hide', {
    preHandler: [verifyToken, verifyAdmin],
    handler: commentController.hideComment,
  });
}
