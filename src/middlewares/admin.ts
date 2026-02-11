import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/prisma';

/**
 * Middleware to verify if user has ADMIN role
 * Must be used after verifyToken middleware
 */
export const verifyAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      return reply.code(401).send({
        success: false,
        message: 'Autenticacao necessaria',
      });
    }

    // Get user with role from database
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        email: true,
      },
    });

    if (!fullUser) {
      return reply.code(401).send({
        success: false,
        message: 'Usuario nao encontrado',
      });
    }

    if (fullUser.role !== 'ADMIN') {
      console.log(`[Admin Middleware] Access denied for user ${fullUser.email} (role: ${fullUser.role})`);
      return reply.code(403).send({
        success: false,
        message: 'Acesso restrito a administradores',
      });
    }

    // Add full user info to request
    (req as any).adminUser = fullUser;

    console.log(`[Admin Middleware] Admin access granted for ${fullUser.email}`);
  } catch (error: any) {
    console.error('[Admin Middleware] Error:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao verificar permissoes',
    });
  }
};

/**
 * Middleware to verify if user has CREATOR or ADMIN role
 * For content creation endpoints
 */
export const verifyCreator = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      return reply.code(401).send({
        success: false,
        message: 'Autenticacao necessaria',
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        email: true,
      },
    });

    if (!fullUser) {
      return reply.code(401).send({
        success: false,
        message: 'Usuario nao encontrado',
      });
    }

    if (fullUser.role !== 'ADMIN' && fullUser.role !== 'CREATOR') {
      console.log(`[Creator Middleware] Access denied for user ${fullUser.email} (role: ${fullUser.role})`);
      return reply.code(403).send({
        success: false,
        message: 'Acesso restrito a criadores de conteudo',
      });
    }

    (req as any).creatorUser = fullUser;

    console.log(`[Creator Middleware] Creator access granted for ${fullUser.email}`);
  } catch (error: any) {
    console.error('[Creator Middleware] Error:', error.message);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao verificar permissoes',
    });
  }
};

export default {
  verifyAdmin,
  verifyCreator,
};
