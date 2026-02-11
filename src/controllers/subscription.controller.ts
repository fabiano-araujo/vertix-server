import { FastifyRequest, FastifyReply } from 'fastify';
import * as subscriptionRepository from '../repositories/subscription.repository';

interface CreateSubscriptionParams {
  userId: number;
  planType: "semanal" | "mensal" | "anual";
  paymentId?: string;
}

/**
 * Cria uma nova assinatura para um usuário
 */
export const createSubscription = async (req: FastifyRequest<{ Body: CreateSubscriptionParams }>, reply: FastifyReply) => {
  try {
    const { userId, planType, paymentId } = req.body;

    // Verificar se o ID do usuário foi fornecido
    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }

    // Verificar se o tipo de plano é válido
    if (!planType || !['semanal', 'mensal', 'anual'].includes(planType)) {
      return reply.code(400).send({
        success: false,
        message: 'Tipo de plano inválido. Deve ser semanal, mensal ou anual'
      });
    }

    // Criar a assinatura baseada no tipo de plano
    const subscription = await subscriptionRepository.createSubscriptionByPlan(userId, planType, paymentId);

    return reply.code(201).send({
      success: true,
      data: {
        ...subscription,
        expirationDate: subscription.expirationDate,
        isPremium: true
      },
      message: `Assinatura ${planType} criada com sucesso. Válida até ${subscription.expirationDate.toLocaleDateString()}`
    });

  } catch (error: any) {
    console.error('Erro ao criar assinatura:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao criar assinatura',
      error: error.message
    });
  }
};

/**
 * Obtém a assinatura ativa de um usuário
 */
export const getActiveSubscription = async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID de usuário inválido'
      });
    }

    const subscription = await subscriptionRepository.findActiveSubscriptionByUserId(userId);

    if (!subscription) {
      return reply.code(404).send({
        success: false,
        message: 'Nenhuma assinatura ativa encontrada para este usuário'
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        ...subscription,
        expirationDate: subscription.expirationDate,
        isPremium: true
      },
      message: `Assinatura ativa encontrada. Plano ${subscription.planType} válido até ${subscription.expirationDate.toLocaleDateString()}`
    });

  } catch (error: any) {
    console.error('Erro ao obter assinatura ativa:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao obter assinatura ativa',
      error: error.message
    });
  }
};

/**
 * Obtém todas as assinaturas de um usuário
 */
export const getUserSubscriptions = async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID de usuário inválido'
      });
    }

    const subscriptions = await subscriptionRepository.findSubscriptionsByUserId(userId);

    return reply.code(200).send({
      success: true,
      data: subscriptions,
      message: 'Assinaturas do usuário encontradas'
    });

  } catch (error: any) {
    console.error('Erro ao obter assinaturas do usuário:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao obter assinaturas do usuário',
      error: error.message
    });
  }
};

/**
 * Cancela uma assinatura
 */
export const cancelSubscription = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return reply.code(400).send({
        success: false,
        message: 'ID de assinatura inválido'
      });
    }

    const subscription = await subscriptionRepository.findSubscriptionById(id);

    if (!subscription) {
      return reply.code(404).send({
        success: false,
        message: 'Assinatura não encontrada'
      });
    }

    await subscriptionRepository.cancelSubscription(id);

    return reply.code(200).send({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao cancelar assinatura:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao cancelar assinatura',
      error: error.message
    });
  }
};

/**
 * Verifica se um usuário tem uma assinatura premium ativa
 */
export const checkUserPremiumStatus = async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID de usuário inválido'
      });
    }

    const subscription = await subscriptionRepository.findActiveSubscriptionByUserId(userId);
    const hasActiveSubscription = !!subscription;
    const planType = subscription ? subscription.planType : 'free';

    return reply.code(200).send({
      success: true,
      data: {
        isPremium: hasActiveSubscription,
        planType: planType,
        expirationDate: subscription ? subscription.expirationDate : null
      },
      message: hasActiveSubscription 
        ? `Usuário possui assinatura ativa do tipo ${planType} até ${subscription!.expirationDate.toLocaleDateString()}` 
        : 'Usuário não possui assinatura ativa'
    });

  } catch (error: any) {
    console.error('Erro ao verificar status premium:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao verificar status premium',
      error: error.message
    });
  }
};

/**
 * Obtém a configuração de assinatura do usuário em formato amigável para o frontend
 */
export const getSubscriptionConfig = async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID de usuário inválido'
      });
    }

    const subscription = await subscriptionRepository.findActiveSubscriptionByUserId(userId);
    const hasActiveSubscription = !!subscription;
    
    // Formatar resposta para o frontend
    const subscriptionConfig = {
      isPremium: hasActiveSubscription,
      planType: subscription ? subscription.planType : 'free',
      expirationDate: subscription ? subscription.expirationDate : null,
      formattedExpirationDate: subscription ? subscription.expirationDate.toLocaleDateString() : null,
      active: subscription ? subscription.active : false,
      remainingDays: subscription ? 
        Math.max(0, Math.ceil((subscription.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
    };

    return reply.code(200).send({
      success: true,
      data: subscriptionConfig,
      message: hasActiveSubscription 
        ? `Assinatura ${subscriptionConfig.planType} ativa por mais ${subscriptionConfig.remainingDays} dias` 
        : 'Usuário utilizando plano gratuito'
    });

  } catch (error: any) {
    console.error('Erro ao obter configuração de assinatura:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao obter configuração de assinatura',
      error: error.message
    });
  }
}; 