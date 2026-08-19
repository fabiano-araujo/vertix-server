import { FastifyReply, FastifyRequest } from 'fastify';
import * as creditsRepository from '../repositories/credits.repository';

type UserParams = { userId: string };
type DeviceParams = { deviceId: string };

export const getMyCredits = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = Number((req as any).user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return reply.code(401).send({
        success: false,
        message: 'Autenticacao necessaria'
      });
    }

    const userCredits = await creditsRepository.getUserCredits(userId);
    await creditsRepository.updateLastCheck(userId);

    return reply.code(200).send({
      success: true,
      data: {
        availableCredits: userCredits.availableCredits,
        lastReset: userCredits.lastReset,
        locked: userCredits.isLocked(),
      }
    });
  } catch (error: any) {
    console.error('Erro ao obter creditos do usuario:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao obter creditos do usuario',
      error: error.message
    });
  }
};

/**
 * Créditos por usuário autenticado
 */
export const getUserCredits = async (req: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (Number.isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    const userCredits = await creditsRepository.getUserCredits(userId);
    await creditsRepository.updateLastCheck(userId);

    return reply.code(200).send({
      success: true,
      data: {
        availableCredits: userCredits.availableCredits,
        lastReset: userCredits.lastReset
      }
    });
  } catch (error: any) {
    console.error('Erro ao obter créditos do usuário:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao obter créditos do usuário',
      error: error.message
    });
  }
};

/**
 * Créditos vinculados ao dispositivo (sem login)
 */
export const getDeviceCredits = async (req: FastifyRequest<{ Body: { deviceId: string } }>, reply: FastifyReply) => {
  try {
    const { deviceId } = req.body;
    console.log('💳 [CREDITS_CONTROLLER] Recebendo requisição para deviceId:', deviceId);

    if (!deviceId || deviceId.trim().length < 6) {
      console.log('❌ [CREDITS_CONTROLLER] DeviceId inválido:', deviceId);
      return reply.code(400).send({
        success: false,
        message: 'ID do dispositivo inválido'
      });
    }

    console.log('💳 [CREDITS_CONTROLLER] Buscando créditos no repositório...');
    const credits = await creditsRepository.getDeviceCredits(deviceId.trim());
    console.log('💳 [CREDITS_CONTROLLER] Créditos encontrados:', credits.availableCredits);

    await creditsRepository.updateDeviceLastCheck(deviceId.trim());

    return reply.code(200).send({
      success: true,
      data: {
        availableCredits: credits.availableCredits,
        lastReset: credits.lastReset
      }
    });
  } catch (error: any) {
    console.error('❌ [CREDITS_CONTROLLER] Erro ao obter créditos do dispositivo:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao obter créditos do dispositivo',
      error: error.message
    });
  }
};

/**
 * Adiciona créditos ao dispositivo (ex.: recompensa de anúncio)
 */
export const addDeviceCredits = async (
  req: FastifyRequest<{ Body: { deviceId: string; amount?: number; maxLimit?: number } }>,
  reply: FastifyReply
) => {
  try {
    const { deviceId } = req.body;
    const amount = Math.max(1, Math.floor(req.body?.amount ?? 5));
    const maxLimit = Math.max(amount, Math.floor(req.body?.maxLimit ?? 100));

    if (!deviceId || deviceId.trim().length < 6) {
      return reply.code(400).send({
        success: false,
        message: 'ID do dispositivo inválido'
      });
    }

    const credits = await creditsRepository.addDeviceCredits(deviceId.trim(), amount, maxLimit);

    return reply.code(200).send({
      success: true,
      data: {
        availableCredits: credits.availableCredits,
        lastReset: credits.lastReset
      }
    });
  } catch (error: any) {
    console.error('Erro ao adicionar créditos ao dispositivo:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erro ao adicionar créditos ao dispositivo',
      error: error.message
    });
  }
};
