import { FastifyReply, FastifyRequest } from 'fastify';
import * as dolaGenerationService from '../services/dola-generation.service';

const fail = (reply: FastifyReply, error: any, status = 400) => {
  reply.code(status).send({
    success: false,
    message: error?.message || 'Falha no gerador Dola.',
  });
};

export const getProfiles = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    reply.send({
      success: true,
      data: dolaGenerationService.listAvailableProfiles(),
    });
  } catch (error) {
    fail(reply, error);
  }
};

export const createJob = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      reply.code(400).send({ success: false, message: 'Informe o prompt da cena.' });
      return;
    }
    const job = dolaGenerationService.createDolaJob({
      prompt,
      takeId: body.takeId,
      takeTitle: body.takeTitle,
      durationSeconds: body.durationSeconds,
      aspectRatio: body.aspectRatio,
      model: body.model,
      creditProfile: body.creditProfile || 'Pre-Writes',
      references: Array.isArray(body.references) ? body.references : [],
    });
    reply.send({ success: true, data: job });
  } catch (error) {
    fail(reply, error);
  }
};

export const getJob = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params: any = request.params || {};
    const job = dolaGenerationService.getDolaJob(String(params.jobId || ''));
    if (!job) {
      reply.code(404).send({ success: false, message: 'Job Dola não encontrado.' });
      return;
    }
    reply.send({ success: true, data: job });
  } catch (error) {
    fail(reply, error);
  }
};

export const cancelJob = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params: any = request.params || {};
    const job = dolaGenerationService.cancelDolaJob(String(params.jobId || ''));
    if (!job) {
      reply.code(404).send({ success: false, message: 'Job Dola não encontrado.' });
      return;
    }
    reply.send({ success: true, data: job });
  } catch (error) {
    fail(reply, error);
  }
};

export const getConfig = async (_request: FastifyRequest, reply: FastifyReply) => {
  reply.send({ success: true, data: dolaGenerationService.dolaConfig() });
};
