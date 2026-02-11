import { FastifyRequest, FastifyReply } from 'fastify';
import aiGenerationService from '../services/ai-generation.service';
import { prisma } from '../services/prisma';

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
      averageDuration: parseInt(body.averageDuration) || 60,
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
        });
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
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return reply.send({
      success: true,
      data: jobs,
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
// GET JOB STATUS
// ============================================

export const getJobStatus = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
      });
    }

    const job = await prisma.aIGenerationJob.findUnique({
      where: { id: jobId },
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

    if (isNaN(jobId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID invalido',
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

export default {
  generateSeries,
  getJobs,
  getJobStatus,
  cancelJob,
  getAnalytics,
  listUsers,
  updateUserRole,
};
