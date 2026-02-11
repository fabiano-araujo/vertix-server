import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

/**
 * Middleware para verificar autenticação com token JWT
 */
export const verifyToken = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return reply.code(401).send({ 
        success: false, 
        message: 'Token de autenticação necessário'
      });
    }
    
    // Formato do cabeçalho: "Bearer TOKEN"
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return reply.code(401).send({ 
        success: false, 
        message: 'Formato de token inválido'
      });
    }
    
    // Verificar o token
    try {
      const decoded = jwt.verify(token, String(process.env.TOKEN_KEY));
      // Adicionar os dados do usuário ao request
      req.user = decoded;
    } catch (tokenError: any) {
      if (tokenError.name === 'TokenExpiredError') {
        return reply.code(401).send({ 
          success: false, 
          message: 'Token expirado'
        });
      }
      
      return reply.code(401).send({ 
        success: false, 
        message: 'Token inválido'
      });
    }
  } catch (error: any) {
    console.error('Erro na verificação do token:', error);
    return reply.code(500).send({ 
      success: false, 
      message: 'Erro interno na verificação de autenticação'
    });
  }
};

// Declare module para estender o tipo FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
  }
}