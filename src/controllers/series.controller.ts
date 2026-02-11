import { FastifyRequest, FastifyReply } from 'fastify';
import * as seriesRepository from '../repositories/series.repository';
import * as episodeRepository from '../repositories/episode.repository';

// ============================================
// LIST SERIES
// ============================================

export const listSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;
    const genre = query.genre;
    const status = query.status || 'PUBLISHED';
    const search = query.search;

    const result = await seriesRepository.findAllSeries(
      { genre, status, search },
      limit,
      offset
    );

    return reply.send({
      success: true,
      data: result.series,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: offset + result.series.length < result.total,
      },
    });
  } catch (error: any) {
    console.error('[Series Controller] Error listing series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao listar series',
    });
  }
};

// ============================================
// GET SERIES BY ID
// ============================================

export const getSeriesById = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const series = await seriesRepository.findSeriesById(seriesId);

    if (!series) {
      return reply.code(404).send({
        success: false,
        message: 'Serie nao encontrada',
      });
    }

    return reply.send({
      success: true,
      data: series,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error getting series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar serie',
    });
  }
};

// ============================================
// GET SERIES EPISODES
// ============================================

export const getSeriesEpisodes = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const episodes = await episodeRepository.findEpisodesBySeriesId(seriesId);

    return reply.send({
      success: true,
      data: episodes,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error getting episodes:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar episodios',
    });
  }
};

// ============================================
// CREATE SERIES (Admin only)
// ============================================

export const createSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const body = req.body as any;

    if (!body.title || !body.description || !body.genre || !body.coverUrl) {
      return reply.code(400).send({
        success: false,
        message: 'Campos obrigatorios: title, description, genre, coverUrl',
      });
    }

    const series = await seriesRepository.createSeries({
      title: body.title,
      description: body.description,
      coverUrl: body.coverUrl,
      thumbnailUrl: body.thumbnailUrl,
      genre: body.genre,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      createdById: user.id,
      status: body.status || 'DRAFT',
      isAiGenerated: body.isAiGenerated || false,
    });

    return reply.code(201).send({
      success: true,
      message: 'Serie criada com sucesso',
      data: series,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error creating series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao criar serie',
    });
  }
};

// ============================================
// UPDATE SERIES (Admin only)
// ============================================

export const updateSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);
    const body = req.body as any;

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const existingSeries = await seriesRepository.findSeriesById(seriesId);
    if (!existingSeries) {
      return reply.code(404).send({
        success: false,
        message: 'Serie nao encontrada',
      });
    }

    const series = await seriesRepository.updateSeries(seriesId, {
      title: body.title,
      description: body.description,
      coverUrl: body.coverUrl,
      thumbnailUrl: body.thumbnailUrl,
      genre: body.genre,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      status: body.status,
    });

    return reply.send({
      success: true,
      message: 'Serie atualizada com sucesso',
      data: series,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error updating series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao atualizar serie',
    });
  }
};

// ============================================
// DELETE SERIES (Admin only)
// ============================================

export const deleteSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const existingSeries = await seriesRepository.findSeriesById(seriesId);
    if (!existingSeries) {
      return reply.code(404).send({
        success: false,
        message: 'Serie nao encontrada',
      });
    }

    await seriesRepository.deleteSeries(seriesId);

    return reply.send({
      success: true,
      message: 'Serie excluida com sucesso',
    });
  } catch (error: any) {
    console.error('[Series Controller] Error deleting series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao excluir serie',
    });
  }
};

// ============================================
// PUBLISH SERIES (Admin only)
// ============================================

export const publishSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const series = await seriesRepository.publishSeries(seriesId);

    return reply.send({
      success: true,
      message: 'Serie publicada com sucesso',
      data: series,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error publishing series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao publicar serie',
    });
  }
};

// ============================================
// TRENDING & NEW
// ============================================

export const getTrendingSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 10;

    const series = await seriesRepository.findTrendingSeries(limit);

    return reply.send({
      success: true,
      data: series,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error getting trending:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar series em alta',
    });
  }
};

export const getNewSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 10;

    const series = await seriesRepository.findNewSeries(limit);

    return reply.send({
      success: true,
      data: series,
    });
  } catch (error: any) {
    console.error('[Series Controller] Error getting new series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar novas series',
    });
  }
};

export default {
  listSeries,
  getSeriesById,
  getSeriesEpisodes,
  createSeries,
  updateSeries,
  deleteSeries,
  publishSeries,
  getTrendingSeries,
  getNewSeries,
};
