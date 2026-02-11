import { PrismaClient, DeviceCredits as DeviceCreditsRecord, UserCredits as UserCreditsRecord } from '@prisma/client';
import { UserCredits, DeviceCredits } from '../models/credits.types';
import * as subscriptionRepository from './subscription.repository';

const prisma = new PrismaClient();

// Limites de créditos diários
const FREE_CREDIT_LIMIT = 2;     // Usuário gratuito: 2 mensagens/dia
const PREMIUM_CREDIT_LIMIT = 10; // Usuário premium: 10 mensagens/dia
const DEVICE_CREDIT_LIMIT = 2;   // Dispositivo anônimo: 2 mensagens/dia
const AD_BONUS_CREDITS = 2;      // Créditos ganhos por anúncio

const toUserCredits = (record: UserCreditsRecord): UserCredits =>
  new UserCredits(
    record.id,
    record.userId,
    record.availableCredits,
    record.dailyStart,
    record.lockUntil,
    record.adsWatchedToday,
    record.adInProgress,
    record.createdAt,
    record.updatedAt
  );

const toDeviceCredits = (record: DeviceCreditsRecord): DeviceCredits =>
  new DeviceCredits(
    record.id,
    record.deviceId,
    record.availableCredits,
    record.lastReset,
    record.lastCheck,
    record.createdAt,
    record.updatedAt
  );

/**
 * Inicializa ou recupera os créditos de um usuário
 */
export const getUserCredits = async (userId: number): Promise<UserCredits> => {
  try {
    console.log('[CREDITS_REPO] ========== getUserCredits INICIANDO ==========');
    console.log('[CREDITS_REPO] Buscando créditos para userId:', userId);

    let creditsRecord = await prisma.userCredits.findUnique({
      where: { userId }
    });

    console.log('[CREDITS_REPO] Registro de créditos encontrado:', creditsRecord ? 'SIM' : 'NÃO');

    console.log('[CREDITS_REPO] Verificando status premium...');
    const isPremium = await subscriptionRepository.checkUserPremiumStatus(userId);
    console.log('[CREDITS_REPO] Status premium:', isPremium);

    const creditsLimit = isPremium ? PREMIUM_CREDIT_LIMIT : FREE_CREDIT_LIMIT;
    console.log('[CREDITS_REPO] Limite de créditos:', creditsLimit);

    if (!creditsRecord) {
      console.log('[CREDITS_REPO] Criando novo registro de créditos...');

      // CRÍTICO: Verifica se usuário existe antes de criar
      console.log('[CREDITS_REPO] Verificando se usuário existe no banco...');
      const userExists = await prisma.user.findUnique({ where: { id: userId } });

      if (!userExists) {
        console.error('[CREDITS_REPO] ❌ ERRO: Usuário não existe! userId:', userId);
        throw new Error(`Usuário ${userId} não encontrado no banco de dados`);
      }

      console.log('[CREDITS_REPO] ✅ Usuário existe, criando registro de créditos...');

      creditsRecord = await prisma.userCredits.create({
        data: {
          userId,
          availableCredits: creditsLimit,
          dailyStart: new Date(),
          lockUntil: null,
          adsWatchedToday: 0,
          adInProgress: false
        }
      });

      console.log('[CREDITS_REPO] ✅ Registro de créditos criado com sucesso');
    } else {
      // Verifica se precisa resetar (passou 24h desde dailyStart)
      const userCredits = toUserCredits(creditsRecord);

      if (userCredits.shouldResetCredits()) {
        console.log('[CREDITS_REPO] Resetando créditos diários (passou 24h)...');

        creditsRecord = await prisma.userCredits.update({
          where: { userId },
          data: {
            availableCredits: creditsLimit,
            dailyStart: new Date(),
            lockUntil: null,
            adsWatchedToday: 0,
            adInProgress: false
          }
        });

        console.log('[CREDITS_REPO] ✅ Créditos resetados com sucesso');
      } else {
        console.log('[CREDITS_REPO] Créditos ainda dentro do período de 24h, não resetando');
      }
    }

    console.log('[CREDITS_REPO] ✅ getUserCredits finalizado com sucesso');
    console.log('[CREDITS_REPO] Créditos disponíveis:', creditsRecord.availableCredits);
    return toUserCredits(creditsRecord);
  } catch (error: any) {
    console.error('[CREDITS_REPO] ❌ ERRO CAPTURADO em getUserCredits');
    console.error('[CREDITS_REPO] ❌ Tipo do erro:', error.constructor.name);
    console.error('[CREDITS_REPO] ❌ Mensagem:', error.message);
    console.error('[CREDITS_REPO] ❌ Stack completo:', error.stack);

    // Se for erro do Prisma, mostra detalhes adicionais
    if (error.code) {
      console.error('[CREDITS_REPO] ❌ Código do erro Prisma:', error.code);
    }
    if (error.meta) {
      console.error('[CREDITS_REPO] ❌ Meta do erro Prisma:', JSON.stringify(error.meta, null, 2));
    }

    throw new Error(`Erro ao obter créditos do usuário: ${error.message}`);
  }
};

/**
 * Consome créditos de um usuário (validação segura no servidor)
 */
export const consumeUserCredit = async (userId: number): Promise<{ success: boolean; credits: UserCredits; reason?: string }> => {
  try {
    console.log('[CREDITS_REPO] ========== consumeUserCredit INICIANDO ==========');
    console.log('[CREDITS_REPO] userId:', userId);

    const userCredits = await getUserCredits(userId);
    console.log('[CREDITS_REPO] Créditos obtidos:', userCredits.availableCredits);

    // Verifica se está bloqueado
    if (userCredits.isLocked()) {
      console.log('[CREDITS_REPO] ⛔ Usuário está BLOQUEADO (locked)');
      return {
        success: false,
        credits: userCredits,
        reason: 'locked'
      };
    }

    // Verifica se tem créditos
    if (userCredits.availableCredits <= 0) {
      console.log('[CREDITS_REPO] ⛔ SEM CRÉDITOS (availableCredits <= 0)');
      return {
        success: false,
        credits: userCredits,
        reason: 'no_credits'
      };
    }

    // Consome o crédito
    const newCredits = userCredits.availableCredits - 1;
    let lockUntil = userCredits.lockUntil;

    console.log('[CREDITS_REPO] Consumindo 1 crédito. Créditos após consumo:', newCredits);

    // Se zerou créditos, bloqueia por 24h
    if (newCredits === 0) {
      lockUntil = new Date(userCredits.dailyStart.getTime() + 24 * 60 * 60 * 1000);
      console.log('[CREDITS_REPO] ⚠️ Créditos zerados, bloqueando até:', lockUntil);
    }

    console.log('[CREDITS_REPO] Atualizando registro no banco...');
    const updated = await prisma.userCredits.update({
      where: { userId },
      data: {
        availableCredits: newCredits,
        lockUntil: lockUntil,
        updatedAt: new Date()
      }
    });

    console.log('[CREDITS_REPO] ✅ Crédito consumido com sucesso');
    return {
      success: true,
      credits: toUserCredits(updated)
    };
  } catch (error: any) {
    console.error('[CREDITS_REPO] ❌ ERRO em consumeUserCredit');
    console.error('[CREDITS_REPO] ❌ Mensagem:', error.message);
    console.error('[CREDITS_REPO] ❌ Stack:', error.stack);
    throw new Error('Erro ao consumir crédito do usuário');
  }
};

/**
 * Inicia processo de assistir anúncio
 */
export const startUserAd = async (userId: number): Promise<{ success: boolean; credits: UserCredits; reason?: string }> => {
  try {
    const userCredits = await getUserCredits(userId);

    // Só pode assistir anúncio se não tiver créditos
    if (userCredits.availableCredits > 0) {
      return {
        success: false,
        credits: userCredits,
        reason: 'has_credits'
      };
    }

    // Verifica se já tem anúncio em andamento
    if (userCredits.adInProgress) {
      return {
        success: false,
        credits: userCredits,
        reason: 'ad_in_progress'
      };
    }

    const updated = await prisma.userCredits.update({
      where: { userId },
      data: {
        adInProgress: true,
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      credits: toUserCredits(updated)
    };
  } catch (error) {
    console.error('Erro ao iniciar anúncio:', error);
    throw new Error('Erro ao iniciar anúncio');
  }
};

/**
 * Completa processo de assistir anúncio
 */
export const completeUserAd = async (userId: number, success: boolean): Promise<UserCredits> => {
  try {
    const userCredits = await getUserCredits(userId);
    const isPremium = await subscriptionRepository.checkUserPremiumStatus(userId);
    const baseLimit = isPremium ? PREMIUM_CREDIT_LIMIT : FREE_CREDIT_LIMIT;

    let newCredits = userCredits.availableCredits;
    let newAdsWatched = userCredits.adsWatchedToday;
    let lockUntil = userCredits.lockUntil;

    if (success) {
      // Adiciona créditos bônus
      newCredits = userCredits.availableCredits + AD_BONUS_CREDITS;
      newAdsWatched = userCredits.adsWatchedToday + 1;

      // Remove o bloqueio
      lockUntil = null;
    }

    const updated = await prisma.userCredits.update({
      where: { userId },
      data: {
        availableCredits: newCredits,
        adsWatchedToday: newAdsWatched,
        lockUntil: lockUntil,
        adInProgress: false,
        updatedAt: new Date()
      }
    });

    return toUserCredits(updated);
  } catch (error) {
    console.error('Erro ao completar anúncio:', error);
    throw new Error('Erro ao completar anúncio');
  }
};

/**
 * Reseta o estado de anúncio em andamento (caso de erro ou timeout)
 */
export const resetUserAdProgress = async (userId: number): Promise<UserCredits> => {
  try {
    const updated = await prisma.userCredits.update({
      where: { userId },
      data: {
        adInProgress: false,
        updatedAt: new Date()
      }
    });

    return toUserCredits(updated);
  } catch (error) {
    console.error('Erro ao resetar progresso do anúncio:', error);
    throw new Error('Erro ao resetar progresso do anúncio');
  }
};

// ========== FUNÇÕES DE DISPOSITIVO (mantidas para compatibilidade) ==========

/**
 * Obtém ou cria créditos vinculados a um dispositivo
 */
export const getDeviceCredits = async (deviceId: string): Promise<DeviceCredits> => {
  try {
    let creditsRecord = await prisma.deviceCredits.findUnique({
      where: { deviceId }
    });

    if (!creditsRecord) {
      creditsRecord = await prisma.deviceCredits.create({
        data: {
          deviceId,
          availableCredits: DEVICE_CREDIT_LIMIT,
          lastReset: new Date(),
          lastCheck: new Date()
        }
      });
    } else {
      const deviceCredits = toDeviceCredits(creditsRecord);

      if (deviceCredits.shouldResetCredits()) {
        creditsRecord = await prisma.deviceCredits.update({
          where: { deviceId },
          data: {
            availableCredits: DEVICE_CREDIT_LIMIT,
            lastReset: new Date(),
            lastCheck: new Date()
          }
        });
      }
    }

    return toDeviceCredits(creditsRecord);
  } catch (error) {
    console.error('Erro ao obter créditos do dispositivo:', error);
    throw new Error('Erro ao obter créditos do dispositivo');
  }
};

/**
 * Consome créditos de um dispositivo
 */
export const consumeDeviceCredits = async (deviceId: string, amount: number): Promise<boolean> => {
  try {
    const deviceCredits = await getDeviceCredits(deviceId);

    if (deviceCredits.availableCredits < amount) {
      return false;
    }

    await prisma.deviceCredits.update({
      where: { deviceId },
      data: {
        availableCredits: deviceCredits.availableCredits - amount,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Erro ao consumir créditos do dispositivo:', error);
    throw new Error('Erro ao consumir créditos do dispositivo');
  }
};

/**
 * Atualiza a data da última verificação do dispositivo
 */
export const updateDeviceLastCheck = async (deviceId: string): Promise<void> => {
  try {
    await prisma.deviceCredits.update({
      where: { deviceId },
      data: {
        lastCheck: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar data da última verificação do dispositivo:', error);
    throw new Error('Erro ao atualizar data da última verificação do dispositivo');
  }
};

/**
 * Adiciona créditos ao dispositivo (ex.: recompensa de anúncio)
 */
export const addDeviceCredits = async (
  deviceId: string,
  amount: number,
  maxLimit: number = DEVICE_CREDIT_LIMIT
): Promise<DeviceCredits> => {
  try {
    const deviceCredits = await getDeviceCredits(deviceId);
    const newAmount = Math.min(deviceCredits.availableCredits + amount, maxLimit);

    const updated = await prisma.deviceCredits.update({
      where: { deviceId },
      data: {
        availableCredits: newAmount,
        updatedAt: new Date()
      }
    });

    return toDeviceCredits(updated);
  } catch (error) {
    console.error('Erro ao adicionar créditos ao dispositivo:', error);
    throw new Error('Erro ao adicionar créditos ao dispositivo');
  }
};

/**
 * Consome créditos de um usuário (retorna boolean para compatibilidade)
 */
export const consumeCredits = async (userId: number, amount: number): Promise<boolean> => {
  try {
    const userCredits = await getUserCredits(userId);

    if (userCredits.availableCredits < amount) {
      return false;
    }

    await prisma.userCredits.update({
      where: { userId },
      data: {
        availableCredits: userCredits.availableCredits - amount,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Erro ao consumir créditos do usuário:', error);
    return false;
  }
};

/**
 * Atualiza a data da última verificação do usuário
 */
export const updateLastCheck = async (userId: number): Promise<void> => {
  try {
    await prisma.userCredits.update({
      where: { userId },
      data: {
        lastCheck: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar data da última verificação:', error);
  }
};
