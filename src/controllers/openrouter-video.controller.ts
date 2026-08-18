import { FastifyReply, FastifyRequest } from 'fastify';
import * as openrouterVideoService from '../services/openrouter-video.service';

const parseMaybeJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const normalizeUpstream = (value: any): any => {
  if (!value) return value;

  if (Buffer.isBuffer(value)) {
    return parseMaybeJson(value.toString('utf8'));
  }

  if (value instanceof ArrayBuffer) {
    return parseMaybeJson(Buffer.from(value).toString('utf8'));
  }

  if (ArrayBuffer.isView(value)) {
    return parseMaybeJson(Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('utf8'));
  }

  if (typeof value === 'string') {
    return parseMaybeJson(value);
  }

  return value;
};

const fail = (reply: FastifyReply, error: any) => {
  const status = error?.response?.status || (error?.message ? 400 : 500);
  const upstream = normalizeUpstream(error?.response?.data);
  const message =
    upstream?.error?.message ||
    upstream?.errors?.[0]?.message ||
    upstream?.message ||
    upstream?.detail ||
    error?.response?.statusText ||
    error?.message ||
    'Erro inesperado.';

  reply.code(status).send({
    error: {
      message,
      status,
      upstream,
    },
  });
};

export const createVideoJob = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const result = await openrouterVideoService.submitVideoJob(body);
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};

export const getVideoJobStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const params: any = request.params || {};
    const result = await openrouterVideoService.getVideoJobStatus(body, params.jobId);
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};

export const downloadVideoJob = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const params: any = request.params || {};
    const result = await openrouterVideoService.downloadVideoJob({
      ...body,
      jobId: params.jobId,
    });
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};

export const listVideoModels = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const result = await openrouterVideoService.getVideoModels(body.apiKey);
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};

export const generateVoiceReferences = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const result = await openrouterVideoService.generateVoiceReferences(body);
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};

export const generateDubbing = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const result = await openrouterVideoService.generateDubbing(body);
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};

export const assembleVideos = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const result = await openrouterVideoService.assembleVideos(body);
    reply.send(result);
  } catch (error) {
    fail(reply, error);
  }
};
