import { FastifyRequest, FastifyReply } from 'fastify';
import aiGenerationService from '../services/ai-generation.service';
import seriesProductionService from '../services/series-production.service';
import seriesCatalogService from '../services/series-catalog.service';
import storageService from '../services/storage.service';
import codexWorkflowService, {
  CodexWorkflowRequest,
} from '../services/codex-workflow.service';
import referenceImageJobService, {
  StartReferenceImageJobRequest,
} from '../services/reference-image-job.service';
import { prisma } from '../services/prisma';

const parseJsonField = (value?: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// ============================================
// AI SERIES GENERATION
// ============================================

export const generateSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const body = req.body as any;

    // Validate required fields
    if (!body.theme || !body.genre || !body.episodeCount) {
      return reply.code(400).send({
        success: false,
        message: 'Campos obrigatorios: theme, genre, episodeCount',
      });
    }

    const config = {
      theme: body.theme,
      genre: body.genre,
      episodeCount: parseInt(body.episodeCount),
      averageDuration: parseInt(body.averageDuration || body.duration) || 60,
      targetAudience: body.targetAudience || 'Geral',
      style: body.style,
      language: body.language || 'Português Brasileiro',
    };

    // Start generation asynchronously
    console.log(`[Admin Controller] Starting AI series generation for user ${user.id}`);

    // Create job first and return immediately
    const job = await prisma.aIGenerationJob.create({
      data: {
        type: 'FULL_SERIES',
        status: 'PENDING',
        inputData: JSON.stringify(config),
        createdById: user.id,
        progress: 0,
      },
    });

    // Start generation in background
    setImmediate(async () => {
      try {
        await aiGenerationService.generateFullSeries(config, user.id, (progress, message) => {
          console.log(`[Admin Controller] Generation progress: ${progress}% - ${message}`);
        }, job.id);
      } catch (error: any) {
        console.error('[Admin Controller] Background generation failed:', error.message);
      }
    });

    return reply.code(202).send({
      success: true,
      message: 'Geracao de serie iniciada',
      data: {
        jobId: job.id,
        status: 'PENDING',
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error starting generation:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao iniciar geracao de serie',
    });
  }
};

// ============================================
// GET GENERATION JOBS
// ============================================

export const startCodexWorkflow = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const user = (req as any).user;
    const body = (req.body || {}) as CodexWorkflowRequest;
    const job = await codexWorkflowService.startWorkflowJob(body, user.id);

    setImmediate(async () => {
      try {
        await codexWorkflowService.processWorkflowJob(job.id);
      } catch (error: any) {
        console.error(
          `[Admin Controller] Codex job ${job.id} failed:`,
          error?.message || error,
        );
      }
    });

    return reply.code(202).send({
      success: true,
      message: 'Acao enviada ao Codex',
      data: {
        id: job.id,
        seriesId: job.seriesId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error starting Codex workflow:', error.message);
    return reply.code(400).send({
      success: false,
      message: error.message || 'Nao foi possivel iniciar a acao no Codex',
    });
  }
};

export const startReferenceImageJob = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const user = (req as any).user;
    const { id } = req.params as { id: string };
    const seriesId = Number.parseInt(id, 10);
    if (!Number.isInteger(seriesId) || seriesId <= 0) {
      return reply.code(400).send({
        success: false,
        message: 'ID da serie invalido',
      });
    }
    const body = (req.body || {}) as StartReferenceImageJobRequest;
    const started = await referenceImageJobService.startReferenceImageJob(
      seriesId,
      user.id,
      body,
    );
    return reply.code(202).send({
      success: true,
      message: 'Job de imagens criado para o Codex',
      data: {
        id: started.job.id,
        seriesId: started.job.seriesId,
        type: started.job.type,
        status: started.job.status,
        progress: started.job.progress,
        createdAt: started.job.createdAt,
        capabilityToken: started.capabilityToken,
        capabilityExpiresAt: started.capabilityExpiresAt,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error starting reference image job:', error.message);
    return reply.code(400).send({
      success: false,
      message: error.message || 'Nao foi possivel criar o job de imagens',
    });
  }
};

export const getJobs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const status = query.status;

    const where: any = { createdById: user.id };
    if (status) {
      where.status = status;
    }

    const jobs = await prisma.aIGenerationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        seriesId: true,
        type: true,
        status: true,
        progress: true,
        inputData: true,
        outputData: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const parsedJobs = jobs.map((job) => ({
      ...job,
      inputData: parseJsonField(job.inputData),
      outputData: parseJsonField(job.outputData),
    }));

    return reply.send({
      success: true,
      data: parsedJobs,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error getting jobs:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar jobs',
    });
  }
};

// ============================================
// LIST SERIES FOR ADMIN PRODUCTION
// ============================================

export const listAvailableSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 50;
    const offset = parseInt(query.offset) || 0;
    const status = query.status;
    const search = query.search;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { genre: { contains: search } },
      ];
    }

    const [series, total] = await Promise.all([
      prisma.series.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          coverUrl: true,
          thumbnailUrl: true,
          genre: true,
          status: true,
          isAiGenerated: true,
          totalEpisodes: true,
          createdAt: true,
          updatedAt: true,
          productionPlan: {
            select: {
              id: true,
              source: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              episodes: true,
              referenceAssets: true,
              storyPoints: true,
            },
          },
        },
      }),
      prisma.series.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: series,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + series.length < total,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error listing available series:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao listar series disponiveis',
    });
  }
};

// ============================================
// SERIES PRODUCTION PIPELINE DATA
// ============================================

export const getSeriesProduction = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const production = await seriesProductionService.getSeriesProductionPlan(seriesId);

    if (!production) {
      return reply.code(404).send({
        success: false,
        message: 'Dados de producao ainda nao salvos para esta serie',
      });
    }

    return reply.send({
      success: true,
      data: production,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error getting series production:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar dados de producao',
    });
  }
};

export const saveSeriesProduction = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);
    const user = (req as any).user;

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const result = await seriesProductionService.saveSeriesProductionPlan(
      seriesId,
      req.body || {},
      user.id,
    );

    return reply.send({
      success: true,
      message: 'Dados de producao salvos com referencias no Cloudflare R2',
      data: result,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error saving series production:', error.message);
    const status = error.message === 'Serie nao encontrada' ? 404 : 500;
    return reply.code(status).send({
      success: false,
      message: error.message || 'Erro ao salvar dados de producao',
    });
  }
};

export const syncSeriesCatalogAssets = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);
    const user = (req as any).user;

    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const result = await seriesCatalogService.syncSeriesCatalogAssets(
      seriesId,
      (req.body || {}) as any,
      user.id,
    );

    return reply.send({
      success: true,
      message: 'Catalogo da serie sincronizado com Cloudflare R2',
      data: result,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error syncing series catalog assets:', error.message);
    const status = error.message === 'Serie nao encontrada' ? 404 : 400;
    return reply.code(status).send({
      success: false,
      message: error.message || 'Erro ao sincronizar catalogo da serie',
    });
  }
};

export const getSeriesProductionUploadUrl = async (req: FastifyRequest, reply: FastifyReply) => {
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

    if (!body?.filename) {
      return reply.code(400).send({
        success: false,
        message: 'filename e obrigatorio',
      });
    }

    const upload = await storageService.generateProductionAssetUploadUrl(
      seriesId,
      body.filename,
      body.category || 'pipeline',
      body.contentType || 'application/octet-stream',
      body.expiresIn ? parseInt(body.expiresIn) : 3600,
    );

    return reply.send({
      success: true,
      data: upload,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error creating upload URL:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao criar URL de upload',
    });
  }
};

// ============================================
// GET JOB STATUS
// ============================================

export const getJobStatus = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const jobId = parseInt(id);
    const user = (req as any).user;

    if (isNaN(jobId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const job = await prisma.aIGenerationJob.findFirst({
      where: { id: jobId, createdById: user.id },
    });

    if (!job) {
      return reply.code(404).send({
        success: false,
        message: 'Job nao encontrado',
      });
    }

    // Parse output data if completed
    let outputData = null;
    if (job.outputData) {
      try {
        outputData = JSON.parse(job.outputData);
      } catch {}
    }

    return reply.send({
      success: true,
      data: {
        id: job.id,
        seriesId: job.seriesId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        inputData: parseJsonField(job.inputData),
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        outputData,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error getting job status:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar status do job',
    });
  }
};

// ============================================
// CANCEL JOB
// ============================================

export const cancelJob = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const jobId = parseInt(id);
    const user = (req as any).user;

    if (isNaN(jobId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const ownedJob = await prisma.aIGenerationJob.findFirst({
      where: { id: jobId, createdById: user.id },
      select: { id: true },
    });
    if (!ownedJob) {
      return reply.code(404).send({
        success: false,
        message: 'Job nao encontrado',
      });
    }

    await aiGenerationService.cancelJob(jobId);

    return reply.send({
      success: true,
      message: 'Job cancelado com sucesso',
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error cancelling job:', error.message);
    return reply.code(500).send({
      success: false,
      message: error.message || 'Erro ao cancelar job',
    });
  }
};

// ============================================
// ANALYTICS
// ============================================

export const getAnalytics = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const [
      totalSeries,
      totalEpisodes,
      totalUsers,
      totalViews,
      totalLikes,
      totalComments,
      recentSeries,
      topSeries,
    ] = await Promise.all([
      prisma.series.count(),
      prisma.episode.count(),
      prisma.user.count(),
      prisma.episode.aggregate({ _sum: { views: true } }),
      prisma.episodeLike.count(),
      prisma.comment.count(),
      prisma.series.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.series.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { trendingScore: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          trendingScore: true,
          _count: {
            select: { episodes: true },
          },
        },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        totals: {
          series: totalSeries,
          episodes: totalEpisodes,
          users: totalUsers,
          views: totalViews._sum.views || 0,
          likes: totalLikes,
          comments: totalComments,
        },
        recentSeries,
        topSeries,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error getting analytics:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao buscar analytics',
    });
  }
};

// ============================================
// LIST ALL USERS (Admin)
// ============================================

export const listUsers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = req.query as any;
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;
    const role = query.role;

    const where: any = {};
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          photo: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              createdSeries: true,
              comments: true,
              episodeLikes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: users,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + users.length < total,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error listing users:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao listar usuarios',
    });
  }
};

// ============================================
// UPDATE USER ROLE (Admin)
// ============================================

export const updateUserRole = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const userId = parseInt(id);
    const body = req.body as any;

    if (isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    if (!body.role || !['USER', 'CREATOR', 'ADMIN'].includes(body.role)) {
      return reply.code(400).send({
        success: false,
        message: 'Role invalido. Use: USER, CREATOR ou ADMIN',
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: body.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return reply.send({
      success: true,
      message: 'Role atualizado com sucesso',
      data: user,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error updating user role:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao atualizar role do usuario',
    });
  }
};

export const createSeries = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;
    const series = await seriesProductionService.createDraftSeries(user.id, req.body || {});
    return reply.code(201).send({
      success: true,
      message: 'Serie criada na API',
      data: series,
    });
  } catch (error: any) {
    const status = error.message === 'title e obrigatorio' ? 400 : 500;
    return reply.code(status).send({
      success: false,
      message: error.message || 'Erro ao criar serie',
    });
  }
};

export const ingestSeriesReference = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const seriesId = parseInt(id);
    const user = (req as any).user;
    if (isNaN(seriesId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }
    const result = await seriesCatalogService.ingestSeriesReference(
      seriesId,
      (req.body || {}) as any,
      user.id,
    );
    return reply.code(201).send({
      success: true,
      message: 'Referencia salva no catalogo da serie',
      data: result,
    });
  } catch (error: any) {
    const status = error.message === 'Serie nao encontrada' ? 404 : 400;
    return reply.code(status).send({
      success: false,
      message: error.message || 'Erro ao salvar referencia',
    });
  }
};

export default {
  generateSeries,
  startCodexWorkflow,
  startReferenceImageJob,
  getJobs,
  getJobStatus,
  cancelJob,
  createSeries,
  listAvailableSeries,
  getSeriesProduction,
  saveSeriesProduction,
  syncSeriesCatalogAssets,
  ingestSeriesReference,
  getSeriesProductionUploadUrl,
  getAnalytics,
  listUsers,
  updateUserRole,
};
