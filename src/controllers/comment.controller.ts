import { FastifyRequest, FastifyReply } from 'fastify';
import * as commentRepository from '../repositories/comment.repository';

// ============================================
// GET COMMENTS FOR EPISODE
// ============================================

export const getEpisodeComments = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { episodeId } = req.params as { episodeId: string };
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;
    const sortBy = query.sortBy || 'newest';

    const result = await commentRepository.findCommentsByEpisode(
      parseInt(episodeId),
      limit,
      offset,
      sortBy
    );

    // Check if user has liked comments
    const user = (req as any).user;
    if (user?.id) {
      const commentsWithLikeStatus = await Promise.all(
        result.comments.map(async (comment: any) => ({
          ...comment,
          isLiked: await commentRepository.hasUserLikedComment(comment.id, user.id),
        }))
      );
      result.comments = commentsWithLikeStatus;
    }

    return reply.send({
      success: true,
      data: result.comments,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: offset + result.comments.length < result.total,
      },
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error getting comments:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar comentarios',
    });
  }
};

// ============================================
// GET REPLIES FOR COMMENT
// ============================================

export const getCommentReplies = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { commentId } = req.params as { commentId: string };
    const query = req.query as any;
    const limit = parseInt(query.limit) || 10;
    const offset = parseInt(query.offset) || 0;

    const result = await commentRepository.findReplies(parseInt(commentId), limit, offset);

    // Check if user has liked replies
    const user = (req as any).user;
    if (user?.id) {
      const repliesWithLikeStatus = await Promise.all(
        result.replies.map(async (reply: any) => ({
          ...reply,
          isLiked: await commentRepository.hasUserLikedComment(reply.id, user.id),
        }))
      );
      result.replies = repliesWithLikeStatus;
    }

    return reply.send({
      success: true,
      data: result.replies,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: offset + result.replies.length < result.total,
      },
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error getting replies:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar respostas',
    });
  }
};

// ============================================
// CREATE COMMENT
// ============================================

export const createComment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const body = req.body as any;

    if (!body.episodeId || !body.content) {
      return reply.code(400).send({
        success: false,
        message: 'Campos obrigatorios: episodeId, content',
      });
    }

    const content = body.content.trim();
    if (content.length < 1 || content.length > 1000) {
      return reply.code(400).send({
        success: false,
        message: 'Comentario deve ter entre 1 e 1000 caracteres',
      });
    }

    const comment = await commentRepository.createComment({
      episodeId: parseInt(body.episodeId),
      userId: user.id,
      content,
      parentId: body.parentId ? parseInt(body.parentId) : undefined,
    });

    return reply.code(201).send({
      success: true,
      message: body.parentId ? 'Resposta enviada com sucesso' : 'Comentario enviado com sucesso',
      data: comment,
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error creating comment:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao enviar comentario',
    });
  }
};

// ============================================
// UPDATE COMMENT
// ============================================

export const updateComment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const user = (req as any).user;
    const body = req.body as any;

    const existingComment = await commentRepository.findCommentById(parseInt(id));

    if (!existingComment) {
      return reply.code(404).send({
        success: false,
        message: 'Comentario nao encontrado',
      });
    }

    // Check if user owns the comment
    if (existingComment.userId !== user.id) {
      return reply.code(403).send({
        success: false,
        message: 'Voce nao tem permissao para editar este comentario',
      });
    }

    const content = body.content?.trim();
    if (content && (content.length < 1 || content.length > 1000)) {
      return reply.code(400).send({
        success: false,
        message: 'Comentario deve ter entre 1 e 1000 caracteres',
      });
    }

    const comment = await commentRepository.updateComment(parseInt(id), {
      content,
    });

    return reply.send({
      success: true,
      message: 'Comentario atualizado com sucesso',
      data: comment,
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error updating comment:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao atualizar comentario',
    });
  }
};

// ============================================
// DELETE COMMENT
// ============================================

export const deleteComment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const user = (req as any).user;

    const existingComment = await commentRepository.findCommentById(parseInt(id));

    if (!existingComment) {
      return reply.code(404).send({
        success: false,
        message: 'Comentario nao encontrado',
      });
    }

    // Check if user owns the comment or is admin
    const isAdmin = (req as any).adminUser?.role === 'ADMIN';
    if (existingComment.userId !== user.id && !isAdmin) {
      return reply.code(403).send({
        success: false,
        message: 'Voce nao tem permissao para excluir este comentario',
      });
    }

    await commentRepository.deleteComment(parseInt(id));

    return reply.send({
      success: true,
      message: 'Comentario excluido com sucesso',
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error deleting comment:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao excluir comentario',
    });
  }
};

// ============================================
// TOGGLE COMMENT LIKE
// ============================================

export const toggleCommentLike = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const user = (req as any).user;

    const existingComment = await commentRepository.findCommentById(parseInt(id));

    if (!existingComment) {
      return reply.code(404).send({
        success: false,
        message: 'Comentario nao encontrado',
      });
    }

    const isLiked = await commentRepository.toggleCommentLike(parseInt(id), user.id);

    return reply.send({
      success: true,
      data: { isLiked },
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error toggling like:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao curtir comentario',
    });
  }
};

// ============================================
// PIN/UNPIN COMMENT (Admin only)
// ============================================

export const pinComment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const comment = await commentRepository.pinComment(parseInt(id));

    return reply.send({
      success: true,
      message: 'Comentario fixado com sucesso',
      data: comment,
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error pinning comment:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao fixar comentario',
    });
  }
};

export const unpinComment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const comment = await commentRepository.unpinComment(parseInt(id));

    return reply.send({
      success: true,
      message: 'Comentario desfixado com sucesso',
      data: comment,
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error unpinning comment:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao desfixar comentario',
    });
  }
};

// ============================================
// HIDE COMMENT (Admin only)
// ============================================

export const hideComment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const comment = await commentRepository.hideComment(parseInt(id));

    return reply.send({
      success: true,
      message: 'Comentario ocultado com sucesso',
      data: comment,
    });
  } catch (error: any) {
    console.error('[Comment Controller] Error hiding comment:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao ocultar comentario',
    });
  }
};

export default {
  getEpisodeComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  pinComment,
  unpinComment,
  hideComment,
};
