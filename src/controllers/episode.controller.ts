import { FastifyRequest, FastifyReply } from 'fastify';
import * as episodeRepository from '../repositories/episode.repository';
import * as watchHistoryRepository from '../repositories/watch-history.repository';
import recommendationService from '../services/recommendation.service';

// ============================================
// GET EPISODE
// ============================================

export const getEpisode = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const episode = await episodeRepository.findEpisodeById(episodeId);

    if (!episode) {
      return reply.code(404).send({
        success: false,
        message: 'Episodio nao encontrado',
      });
    }

    // Check if user has liked (if authenticated)
    const user = (req as any).user;
    let isLiked = false;
    let watchProgress = 0;

    if (user?.id) {
      isLiked = await episodeRepository.hasUserLiked(episodeId, user.id);
      const history = await watchHistoryRepository.getWatchProgress(user.id, episodeId);
      watchProgress = history?.progress || 0;
    }

    return reply.send({
      success: true,
      data: {
        ...episode,
        isLiked,
        watchProgress,
      },
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error getting episode:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar episodio',
    });
  }
};

// ============================================
// CREATE EPISODE (Admin only)
// ============================================

export const createEpisode = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = req.body as any;

    if (!body.seriesId || !body.episodeNumber || !body.title || !body.videoUrl || !body.duration) {
      return reply.code(400).send({
        success: false,
        message: 'Campos obrigatorios: seriesId, episodeNumber, title, videoUrl, duration',
      });
    }

    const episode = await episodeRepository.createEpisode({
      seriesId: parseInt(body.seriesId),
      episodeNumber: parseInt(body.episodeNumber),
      title: body.title,
      description: body.description,
      videoUrl: body.videoUrl,
      thumbnailUrl: body.thumbnailUrl,
      duration: parseInt(body.duration),
    });

    return reply.code(201).send({
      success: true,
      message: 'Episodio criado com sucesso',
      data: episode,
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error creating episode:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao criar episodio',
    });
  }
};

// ============================================
// UPDATE EPISODE (Admin only)
// ============================================

export const updateEpisode = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);
    const body = req.body as any;

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const episode = await episodeRepository.updateEpisode(episodeId, {
      title: body.title,
      description: body.description,
      videoUrl: body.videoUrl,
      thumbnailUrl: body.thumbnailUrl,
      duration: body.duration ? parseInt(body.duration) : undefined,
    });

    return reply.send({
      success: true,
      message: 'Episodio atualizado com sucesso',
      data: episode,
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error updating episode:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao atualizar episodio',
    });
  }
};

// ============================================
// DELETE EPISODE (Admin only)
// ============================================

export const deleteEpisode = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    await episodeRepository.deleteEpisode(episodeId);

    return reply.send({
      success: true,
      message: 'Episodio excluido com sucesso',
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error deleting episode:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao excluir episodio',
    });
  }
};

// ============================================
// RECORD VIEW
// ============================================

export const recordView = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    await episodeRepository.incrementViews(episodeId);

    return reply.send({
      success: true,
      message: 'Visualizacao registrada',
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error recording view:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao registrar visualizacao',
    });
  }
};

// ============================================
// TOGGLE LIKE
// ============================================

export const toggleLike = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);
    const user = (req as any).user;

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const episode = await episodeRepository.findEpisodeById(episodeId);
    if (!episode) {
      return reply.code(404).send({
        success: false,
        message: 'Episodio nao encontrado',
      });
    }

    const isLiked = await episodeRepository.toggleLike(episodeId, user.id);

    // Update user preferences based on like
    if (isLiked && episode.series?.genre) {
      await recommendationService.updateUserPreferences(user.id, episode.series.genre, 'like');
    }

    return reply.send({
      success: true,
      data: { isLiked },
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error toggling like:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao curtir episodio',
    });
  }
};

// ============================================
// UPDATE WATCH PROGRESS
// ============================================

export const updateProgress = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);
    const user = (req as any).user;
    const body = req.body as any;

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const progress = parseFloat(body.progress);
    if (isNaN(progress) || progress < 0 || progress > 1) {
      return reply.code(400).send({
        success: false,
        message: 'Progress deve ser um numero entre 0 e 1',
      });
    }

    const episode = await episodeRepository.findEpisodeById(episodeId);
    if (!episode) {
      return reply.code(404).send({
        success: false,
        message: 'Episodio nao encontrado',
      });
    }

    // Update watch history
    const history = await watchHistoryRepository.updateWatchProgress({
      userId: user.id,
      episodeId,
      progress,
      watchTime: body.watchTime ? parseInt(body.watchTime) : undefined,
    });

    // Update episode completion rate
    await episodeRepository.updateCompletionRate(episodeId, progress);

    // Update user preferences if watched significant portion
    if (progress >= 0.5 && episode.series?.genre) {
      const action = progress >= 0.9 ? 'complete' : 'view';
      await recommendationService.updateUserPreferences(user.id, episode.series.genre, action);
    }

    return reply.send({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error updating progress:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao atualizar progresso',
    });
  }
};

// ============================================
// RECORD SHARE
// ============================================

export const recordShare = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);
    const user = (req as any).user;

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const episode = await episodeRepository.findEpisodeById(episodeId);
    if (!episode) {
      return reply.code(404).send({
        success: false,
        message: 'Episodio nao encontrado',
      });
    }

    await episodeRepository.incrementShares(episodeId);

    // Update user preferences
    if (episode.series?.genre) {
      await recommendationService.updateUserPreferences(user.id, episode.series.genre, 'share');
    }

    return reply.send({
      success: true,
      message: 'Compartilhamento registrado',
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error recording share:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao registrar compartilhamento',
    });
  }
};

// ============================================
// GET NEXT/PREVIOUS EPISODE
// ============================================

export const getNextEpisode = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const episodeId = parseInt(id);

    if (isNaN(episodeId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const currentEpisode = await episodeRepository.findEpisodeById(episodeId);
    if (!currentEpisode) {
      return reply.code(404).send({
        success: false,
        message: 'Episodio nao encontrado',
      });
    }

    const nextEpisode = await episodeRepository.findNextEpisode(
      currentEpisode.seriesId,
      currentEpisode.episodeNumber
    );

    return reply.send({
      success: true,
      data: nextEpisode,
    });
  } catch (error: any) {
    console.error('[Episode Controller] Error getting next episode:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar proximo episodio',
    });
  }
};

export default {
  getEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  recordView,
  toggleLike,
  updateProgress,
  recordShare,
  getNextEpisode,
};
