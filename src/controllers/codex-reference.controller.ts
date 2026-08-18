import { FastifyReply, FastifyRequest } from 'fastify';

import referenceImageJobService, {
  ReferenceImageJobItemStatus,
} from '../services/reference-image-job.service';

const jobToken = (req: FastifyRequest): string => {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const jobIdFrom = (req: FastifyRequest): number =>
  Number.parseInt((req.params as { id: string }).id, 10);

const referenceIdFrom = (req: FastifyRequest): string =>
  (req.params as { referenceId: string }).referenceId;

const sendError = (reply: FastifyReply, error: any) => {
  const message = error?.message || 'Falha ao processar o job de imagens';
  const unauthorized = message.includes('Credencial') || message.includes('expirou');
  const missing = message.includes('nao encontrado');
  return reply.code(unauthorized ? 401 : missing ? 404 : 400).send({
    success: false,
    message,
  });
};

export const getManifest = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = await referenceImageJobService.getReferenceImageJobManifest(
      jobIdFrom(req),
      jobToken(req),
    );
    return reply.send({ success: true, data });
  } catch (error: any) {
    return sendError(reply, error);
  }
};

export const updateItemStatus = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const body = (req.body || {}) as { status?: string; error?: string };
    const data = await referenceImageJobService.updateReferenceImageItemStatus(
      jobIdFrom(req),
      jobToken(req),
      referenceIdFrom(req),
      String(body.status || '').toUpperCase() as ReferenceImageJobItemStatus,
      body.error,
    );
    return reply.send({ success: true, data });
  } catch (error: any) {
    return sendError(reply, error);
  }
};

export const uploadItem = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = (req.body || {}) as {
      base64?: string;
      dataUrl?: string;
      filename?: string;
      contentType?: string;
    };
    const data = await referenceImageJobService.uploadReferenceImage(
      jobIdFrom(req),
      jobToken(req),
      referenceIdFrom(req),
      body,
    );
    return reply.send({ success: true, data });
  } catch (error: any) {
    return sendError(reply, error);
  }
};

export const completeJob = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = await referenceImageJobService.completeReferenceImageJob(
      jobIdFrom(req),
      jobToken(req),
    );
    return reply.send({ success: true, data });
  } catch (error: any) {
    return sendError(reply, error);
  }
};

export default {
  getManifest,
  updateItemStatus,
  uploadItem,
  completeJob,
};
