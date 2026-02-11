import { PrismaClient } from '@prisma/client';
import { Subscription } from '../models/user.types';

const prisma = new PrismaClient();

// Interface para criação de assinatura Google Play
interface GooglePlaySubscriptionData {
    userId: number;
    planType: string;
    expirationDate: Date;
    platform: string;
    purchaseToken: string;
    orderId?: string;
    productId: string;
    isAutoRenewing?: boolean;
    originalTransactionId?: string;
    acknowledged?: boolean;
}

/**
 * Cria uma nova assinatura para um usuário
 */
export const createSubscription = async (data: {
    userId: number,
    planType: "semanal" | "mensal" | "anual",
    expirationDate: Date,
    paymentId?: string
}) => {
    // Desativa assinaturas pendentes anteriores do usuário
    await prisma.subscription.updateMany({
        where: { 
            userId: data.userId,
            active: false // Assinaturas pendentes são as que têm active = false
        },
        data: { 
            // Marcar como expiradas definindo a data de expiração para o passado
            expirationDate: new Date(Date.now() - 86400000) // 24 horas atrás
        }
    });

    // Não desativamos assinaturas ativas, pois um usuário pode ter múltiplas assinaturas ativas
    // com datas de expiração diferentes

    // Cria uma nova assinatura
    return await prisma.subscription.create({
        data: {
            userId: data.userId,
            planType: data.planType,
            expirationDate: data.expirationDate,
            paymentId: data.paymentId,
            active: false // Começa como não ativa até a confirmação do pagamento
        }
    });
};

/**
 * Encontra uma assinatura por ID
 */
export const findSubscriptionById = async (id: number) => {
    return await prisma.subscription.findUnique({
        where: { id }
    });
};

/**
 * Encontra a assinatura ativa de um usuário
 */
export const findActiveSubscriptionByUserId = async (userId: number) => {
    const currentDate = new Date();
    
    return await prisma.subscription.findFirst({
        where: {
            userId,
            active: true,
            expirationDate: {
                gt: currentDate
            }
        },
        orderBy: {
            expirationDate: 'desc'
        }
    });
};

/**
 * Encontra todas as assinaturas de um usuário
 */
export const findSubscriptionsByUserId = async (userId: number) => {
    return await prisma.subscription.findMany({
        where: { userId },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

/**
 * Cancela uma assinatura (marca como inativa)
 */
export const cancelSubscription = async (id: number) => {
    return await prisma.subscription.update({
        where: { id },
        data: { active: false }
    });
};

/**
 * Verifica se um usuário possui uma assinatura ativa
 */
export const hasActiveSubscription = async (userId: number): Promise<boolean> => {
    const subscription = await findActiveSubscriptionByUserId(userId);
    return !!subscription;
};

/**
 * Verifica se um usuário é premium (tem assinatura ativa)
 */
export const checkUserPremiumStatus = async (userId: number): Promise<boolean> => {
    try {
        console.log('[SUBSCRIPTION_REPO] Verificando status premium para userId:', userId);
        const isPremium = await hasActiveSubscription(userId);
        console.log('[SUBSCRIPTION_REPO] Status premium retornado:', isPremium);
        return isPremium;
    } catch (error: any) {
        console.error('[SUBSCRIPTION_REPO] ❌ ERRO ao verificar status premium');
        console.error('[SUBSCRIPTION_REPO] ❌ Mensagem:', error.message);
        console.error('[SUBSCRIPTION_REPO] ❌ Stack:', error.stack);
        throw error;
    }
};

/**
 * Retorna o tipo de plano do usuário
 */
export const getUserPlanType = async (userId: number): Promise<string> => {
    const subscription = await findActiveSubscriptionByUserId(userId);
    return subscription ? subscription.planType : 'free';
};

/**
 * Calcula a data de expiração correta com base no tipo de plano
 */
const calculateExpirationDate = (planType: string): Date => {
    const expirationDate = new Date();
    
    switch (planType) {
        case 'semanal':
            // 7 dias completos (168 horas)
            return new Date(expirationDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        case 'mensal':
            // Para plano mensal, usamos a mesma data do próximo mês
            // Exemplo: se hoje é 15/04, a expiração será 15/05
            const nextMonth = expirationDate.getMonth() + 1;
            const year = nextMonth === 12 ? expirationDate.getFullYear() + 1 : expirationDate.getFullYear();
            const month = nextMonth % 12;
            const newDate = new Date(year, month, expirationDate.getDate());
            
            // Se o dia do mês não existir no mês de expiração (ex: 31 de abril), 
            // ajustamos para o último dia do mês
            if (newDate.getMonth() !== month) {
                newDate.setDate(0); // Último dia do mês anterior
            }
            
            return newDate;
        case 'anual':
            // Para plano anual, usamos a mesma data do próximo ano
            const yearlyDate = new Date(expirationDate);
            yearlyDate.setFullYear(yearlyDate.getFullYear() + 1);
            return yearlyDate;
        default:
            throw new Error('Tipo de plano inválido');
    }
};

/**
 * Cria uma assinatura com base no tipo de plano e no período
 */
export const createSubscriptionByPlan = async (userId: number, planType: "semanal" | "mensal" | "anual", paymentId?: string) => {
    // Calcula a data de expiração com base no tipo de plano
    const expirationDate = calculateExpirationDate(planType);
    
    return await createSubscription({
        userId,
        planType,
        expirationDate,
        paymentId
    });
};

/**
 * Encontra uma assinatura pelo ID de pagamento
 */
export const findSubscriptionByPaymentId = async (paymentId: string) => {
    return await prisma.subscription.findFirst({
        where: { paymentId }
    });
};

/**
 * Atualiza uma assinatura existente
 */
export const updateSubscription = async (id: number, data: Partial<Subscription>) => {
    return await prisma.subscription.update({
        where: { id },
        data
    });
};

/**
 * Limpa (exclui) assinaturas pendentes expiradas
 * Esta função pode ser executada periodicamente para manter o banco de dados limpo
 */
export const cleanupExpiredPendingSubscriptions = async () => {
    const now = new Date();
    
    // Encontra todas as assinaturas pendentes (não ativas) cuja data de expiração já passou
    const expiredSubscriptions = await prisma.subscription.findMany({
        where: {
            active: false,
            expirationDate: {
                lt: now
            }
        }
    });
    
    if (expiredSubscriptions.length === 0) {
        console.log("Nenhuma assinatura pendente expirada encontrada.");
        return 0;
    }
    
    console.log(`Excluindo ${expiredSubscriptions.length} assinaturas pendentes expiradas...`);
    
    // Excluir assinaturas pendentes expiradas
    const result = await prisma.subscription.deleteMany({
        where: {
            active: false,
            expirationDate: {
                lt: now
            }
        }
    });
    
    console.log(`${result.count} assinaturas pendentes expiradas foram excluídas.`);
    
    return result.count;
};

/**
 * Encontra assinaturas pendentes (não ativas e não expiradas) de um usuário
 */
export const findPendingSubscriptionsByUserId = async (userId: number) => {
    const currentDate = new Date();
    
    return await prisma.subscription.findMany({
        where: {
            userId,
            active: false,
            expirationDate: {
                gt: currentDate // Data de expiração no futuro (ainda não expirada)
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

/**
 * Exclui todas as assinaturas pendentes de um usuário
 */
export const deletePendingSubscriptionsByUserId = async (userId: number): Promise<number> => {
    const currentDate = new Date();
    
    // Primeiro encontra as assinaturas pendentes para poder reportar quantas foram excluídas
    const pendingSubscriptions = await prisma.subscription.findMany({
        where: {
            userId,
            active: false,
            expirationDate: {
                gt: currentDate
            }
        }
    });
    
    if (pendingSubscriptions.length === 0) {
        return 0;
    }
    
    // Excluir todas as assinaturas pendentes
    const result = await prisma.subscription.deleteMany({
        where: {
            userId,
            active: false,
            expirationDate: {
                gt: currentDate
            }
        }
    });
    
    return result.count;
};

// ============================================
// FUNÇÕES PARA GOOGLE PLAY BILLING
// ============================================

/**
 * Cria uma assinatura do Google Play
 */
export const createGooglePlaySubscription = async (data: GooglePlaySubscriptionData) => {
    // Primeiro, desativa assinaturas pendentes anteriores do usuário
    await prisma.subscription.updateMany({
        where: {
            userId: data.userId,
            active: false
        },
        data: {
            expirationDate: new Date(Date.now() - 86400000) // 24 horas atrás
        }
    });

    // Cria a nova assinatura
    return await prisma.subscription.create({
        data: {
            userId: data.userId,
            planType: data.planType,
            expirationDate: data.expirationDate,
            active: true, // Assinatura Google Play já é ativa
            platform: data.platform,
            purchaseToken: data.purchaseToken,
            orderId: data.orderId,
            productId: data.productId,
            isAutoRenewing: data.isAutoRenewing ?? false,
            originalTransactionId: data.originalTransactionId,
            acknowledged: data.acknowledged ?? false,
        }
    });
};

/**
 * Encontra assinatura por purchaseToken
 */
export const findSubscriptionByPurchaseToken = async (purchaseToken: string) => {
    return await prisma.subscription.findFirst({
        where: { purchaseToken }
    });
};

/**
 * Encontra assinatura por orderId
 */
export const findSubscriptionByOrderId = async (orderId: string) => {
    return await prisma.subscription.findFirst({
        where: { orderId }
    });
};

/**
 * Atualiza uma assinatura do Google Play
 */
export const updateGooglePlaySubscription = async (
    id: number,
    data: {
        active?: boolean;
        expirationDate?: Date;
        isAutoRenewing?: boolean;
        cancelReason?: number;
        acknowledged?: boolean;
    }
) => {
    return await prisma.subscription.update({
        where: { id },
        data
    });
};

/**
 * Desativa todas as assinaturas ativas de um usuário
 * Usado antes de criar uma nova assinatura para garantir apenas uma ativa
 */
export const deactivateUserSubscriptions = async (userId: number) => {
    return await prisma.subscription.updateMany({
        where: {
            userId,
            active: true
        },
        data: {
            active: false
        }
    });
};

/**
 * Encontra todas as assinaturas Google Play de um usuário
 */
export const findGooglePlaySubscriptionsByUserId = async (userId: number) => {
    return await prisma.subscription.findMany({
        where: {
            userId,
            platform: 'google_play'
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

/**
 * Verifica se um usuário tem assinatura Google Play ativa
 */
export const hasActiveGooglePlaySubscription = async (userId: number): Promise<boolean> => {
    const currentDate = new Date();

    const subscription = await prisma.subscription.findFirst({
        where: {
            userId,
            platform: 'google_play',
            active: true,
            expirationDate: {
                gt: currentDate
            }
        }
    });

    return !!subscription;
};