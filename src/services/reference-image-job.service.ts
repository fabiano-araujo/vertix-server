import crypto from 'crypto';
import sharp from 'sharp';

import { prisma } from './prisma';
import { compileReferenceImagePrompt } from './reference-image-prompt.service';
import seriesCatalogService from './series-catalog.service';

export const REFERENCE_IMAGE_JOB_TYPE = 'CODEX_GENERATE_REFERENCE_IMAGES';

const CAPABILITY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REFERENCES_PER_JOB = 50;

export type ReferenceImageJobItemStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED';

export type ReferenceImageJobRequestItem = {
  id: string;
  label: string;
  category: string;
  description?: string;
  prompt?: string;
  canonical?: boolean;
  metadata?: Record<string, unknown>;
};

export type StartReferenceImageJobRequest = {
  references?: ReferenceImageJobRequestItem[];
};

type StoredReference = Required<
  Pick<ReferenceImageJobRequestItem, 'id' | 'label' | 'category'>
> & {
  description: string;
  prompt: string;
  canonical: boolean;
  metadata: Record<string, unknown>;
};

type ReferenceImageJobInput = {
  version: 1;
  capabilityHash: string;
  capabilityExpiresAt: string;
  references: StoredReference[];
};

type ReferenceImageJobOutputItem = StoredReference & {
  status: ReferenceImageJobItemStatus;
  error?: string;
  publicUrl?: string;
  storageKey?: string;
  reference?: Record<string, unknown>;
  updatedAt: string;
};

export type ReferenceImageBridgeStatus =
  | 'STARTING'
  | 'STARTED'
  | 'FAILED';

type ReferenceImageBridgeState = {
  status: 'PENDING' | ReferenceImageBridgeStatus;
  message: string;
  threadId?: string;
  updatedAt: string;
};

type ReferenceImageJobOutput = {
  version: 1;
  message: string;
  total: number;
  completed: number;
  failed: number;
  bridge: ReferenceImageBridgeState;
  items: ReferenceImageJobOutputItem[];
};

const parseJsonObject = <T>(value?: string | null): T => {
  if (!value) throw new Error('Job sem dados estruturados');
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Dados estruturados do job invalidos');
  }
  return parsed as T;
};

const cleanText = (value: unknown, maxLength: number): string =>
  String(value || '').trim().slice(0, maxLength);

const normalizeReferences = (
  references: ReferenceImageJobRequestItem[] | undefined,
): StoredReference[] => {
  if (!Array.isArray(references) || references.length === 0) {
    throw new Error('Envie pelo menos uma referencia para gerar');
  }
  if (references.length > MAX_REFERENCES_PER_JOB) {
    throw new Error(`Um job aceita no maximo ${MAX_REFERENCES_PER_JOB} referencias`);
  }

  const seen = new Set<string>();
  return references.map((reference) => {
    const id = cleanText(reference?.id, 180);
    const label = cleanText(reference?.label, 180);
    const category = cleanText(reference?.category, 120).toUpperCase();
    if (!id || !label || !category) {
      throw new Error('Cada referencia precisa de id, label e category');
    }
    if (seen.has(id)) throw new Error(`Referencia duplicada no job: ${id}`);
    seen.add(id);
    const metadata = reference.metadata && typeof reference.metadata === 'object'
      ? reference.metadata
      : {};
    const compiledPrompt = compileReferenceImagePrompt({
      label,
      category,
      description: cleanText(reference.description, 12_000),
      prompt: cleanText(reference.prompt, 20_000),
      metadata,
    });
    return {
      id,
      label,
      category,
      description: cleanText(reference.description, 12_000),
      prompt: compiledPrompt.prompt,
      canonical: reference.canonical !== false,
      metadata: {
        ...metadata,
        ...compiledPrompt.promptMetadata,
        promptContract: compiledPrompt.promptContract,
        visualReferenceMode: compiledPrompt.visualReferenceMode,
      },
    };
  });
};

const capabilityHash = (token: string): string =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const tokenMatches = (token: string, expectedHash: string): boolean => {
  const actual = Buffer.from(capabilityHash(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const calculateProgress = (output: ReferenceImageJobOutput): number => {
  if (output.total === 0) return 100;
  return Math.min(
    100,
    Math.round(((output.completed + output.failed) / output.total) * 100),
  );
};

const recount = (output: ReferenceImageJobOutput): ReferenceImageJobOutput => ({
  ...output,
  completed: output.items.filter((item) => item.status === 'COMPLETED').length,
  failed: output.items.filter((item) => item.status === 'FAILED').length,
});

const loadAuthorizedJob = async (jobId: number, token: string) => {
  if (!Number.isInteger(jobId) || jobId <= 0 || !token.trim()) {
    throw new Error('Credencial do job invalida');
  }
  const job = await prisma.aIGenerationJob.findUnique({ where: { id: jobId } });
  if (!job || job.type !== REFERENCE_IMAGE_JOB_TYPE) {
    throw new Error('Job de imagens nao encontrado');
  }
  const input = parseJsonObject<ReferenceImageJobInput>(job.inputData);
  if (!tokenMatches(token, input.capabilityHash)) {
    throw new Error('Credencial do job invalida');
  }
  if (new Date(input.capabilityExpiresAt).getTime() <= Date.now()) {
    throw new Error('A credencial deste job expirou');
  }
  const output = parseJsonObject<ReferenceImageJobOutput>(job.outputData);
  return { job, input, output };
};

const saveOutput = async (
  jobId: number,
  output: ReferenceImageJobOutput,
  status: string,
  options: { errorMessage?: string | null; completedAt?: Date | null } = {},
) => {
  const counted = recount(output);
  return prisma.aIGenerationJob.update({
    where: { id: jobId },
    data: {
      status,
      progress: calculateProgress(counted),
      outputData: JSON.stringify(counted),
      ...(options.errorMessage !== undefined
        ? { errorMessage: options.errorMessage }
        : {}),
      ...(options.completedAt !== undefined
        ? { completedAt: options.completedAt }
        : {}),
    },
  });
};

export const startReferenceImageJob = async (
  seriesId: number,
  userId: number,
  request: StartReferenceImageJobRequest,
) => {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true },
  });
  if (!series) throw new Error('Serie nao encontrada');

  const references = normalizeReferences(request.references);
  const capabilityToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const input: ReferenceImageJobInput = {
    version: 1,
    capabilityHash: capabilityHash(capabilityToken),
    capabilityExpiresAt: new Date(now.getTime() + CAPABILITY_TTL_MS).toISOString(),
    references,
  };
  const output: ReferenceImageJobOutput = {
    version: 1,
    message: 'Aguardando o Codex iniciar a geracao das imagens',
    total: references.length,
    completed: 0,
    failed: 0,
    bridge: {
      status: 'PENDING',
      message: 'Aguardando a ponte local do Codex',
      updatedAt: now.toISOString(),
    },
    items: references.map((reference) => ({
      ...reference,
      status: 'PENDING',
      updatedAt: now.toISOString(),
    })),
  };
  const job = await prisma.aIGenerationJob.create({
    data: {
      seriesId,
      createdById: userId,
      type: REFERENCE_IMAGE_JOB_TYPE,
      status: 'PENDING',
      progress: 0,
      inputData: JSON.stringify(input),
      outputData: JSON.stringify(output),
    },
  });

  return { job, capabilityToken, capabilityExpiresAt: input.capabilityExpiresAt };
};

export const updateReferenceImageBridgeStatus = async (
  jobId: number,
  token: string,
  status: ReferenceImageBridgeStatus,
  message?: string,
  threadId?: string,
) => {
  const allowed = new Set<ReferenceImageBridgeStatus>([
    'STARTING',
    'STARTED',
    'FAILED',
  ]);
  if (!allowed.has(status)) throw new Error('Status da ponte invalido');

  const { job, output } = await loadAuthorizedJob(jobId, token);
  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
    return { job, output };
  }

  const now = new Date();
  const safeThreadId = cleanText(threadId, 100);
  const fallbackMessage = status === 'STARTING'
    ? 'Ponte local iniciada; criando uma tarefa no Codex'
    : status === 'STARTED'
      ? 'Tarefa iniciada no Codex; aguardando a primeira imagem'
      : 'Nao foi possivel iniciar a tarefa no Codex';
  const safeMessage = cleanText(message, 1_000) || fallbackMessage;
  output.bridge = {
    status,
    message: safeMessage,
    ...(safeThreadId ? { threadId: safeThreadId } : {}),
    updatedAt: now.toISOString(),
  };
  output.message = safeMessage;

  if (status !== 'FAILED') {
    const updatedJob = await saveOutput(jobId, output, 'PROCESSING', {
      errorMessage: null,
    });
    return { job: updatedJob, output: recount(output) };
  }

  for (const item of output.items) {
    if (item.status === 'COMPLETED' || item.status === 'FAILED') continue;
    item.status = 'FAILED';
    item.error = safeMessage;
    item.updatedAt = now.toISOString();
  }
  const counted = recount(output);
  const updatedJob = await saveOutput(jobId, counted, 'FAILED', {
    errorMessage: safeMessage,
    completedAt: now,
  });
  return { job: updatedJob, output: counted };
};

export const getReferenceImageJobManifest = async (
  jobId: number,
  token: string,
) => {
  const { job, input, output } = await loadAuthorizedJob(jobId, token);
  return {
    id: job.id,
    seriesId: job.seriesId,
    status: job.status,
    progress: job.progress,
    expiresAt: input.capabilityExpiresAt,
    references: output.items.map((item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      description: item.description,
      prompt: item.prompt,
      canonical: item.canonical,
      metadata: item.metadata,
      status: item.status,
      publicUrl: item.publicUrl,
      error: item.error,
    })),
  };
};

export const updateReferenceImageItemStatus = async (
  jobId: number,
  token: string,
  referenceId: string,
  status: ReferenceImageJobItemStatus,
  error?: string,
) => {
  const allowed = new Set<ReferenceImageJobItemStatus>([
    'GENERATING',
    'UPLOADING',
    'FAILED',
  ]);
  if (!allowed.has(status)) throw new Error('Status de item invalido');
  const { job, output } = await loadAuthorizedJob(jobId, token);
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
    throw new Error('Este job ja foi encerrado');
  }
  const item = output.items.find((candidate) => candidate.id === referenceId);
  if (!item) throw new Error('Referencia nao pertence a este job');
  if (item.status === 'COMPLETED') return { job, output };

  item.status = status;
  item.updatedAt = new Date().toISOString();
  if (status === 'FAILED') {
    item.error = cleanText(error || 'Falha ao gerar a imagem', 4_000);
  } else {
    delete item.error;
  }
  output.message = status === 'GENERATING'
    ? `Gerando ${item.label}`
    : status === 'UPLOADING'
      ? `Enviando ${item.label} para a Vertix API`
      : `Falha ao gerar ${item.label}`;
  const updatedJob = await saveOutput(jobId, output, 'PROCESSING');
  return { job: updatedJob, output: recount(output) };
};

export const uploadReferenceImage = async (
  jobId: number,
  token: string,
  referenceId: string,
  payload: {
    base64?: string;
    dataUrl?: string;
    filename?: string;
    contentType?: string;
  },
) => {
  const { job, output } = await loadAuthorizedJob(jobId, token);
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
    throw new Error('Este job ja foi encerrado');
  }
  const item = output.items.find((candidate) => candidate.id === referenceId);
  if (!item) throw new Error('Referencia nao pertence a este job');
  if (item.status === 'COMPLETED' && item.reference) {
    return { job, output, reference: item.reference };
  }
  const rawImage = payload.dataUrl || payload.base64 || '';
  if (!rawImage) {
    throw new Error('Envie base64 ou dataUrl da imagem gerada');
  }
  const dataUrlMatch = rawImage.match(/^data:([^;]+);base64,(.*)$/s);
  const imageBuffer = Buffer.from(dataUrlMatch?.[2] || rawImage, 'base64');
  if (!imageBuffer.length || imageBuffer.length > 20 * 1024 * 1024) {
    throw new Error('A imagem precisa ter entre 1 byte e 20 MB');
  }
  let imageMetadata: sharp.Metadata;
  try {
    imageMetadata = await sharp(imageBuffer, { failOn: 'error' }).metadata();
  } catch {
    throw new Error('O arquivo enviado nao e uma imagem raster valida');
  }
  const contentTypes: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const detectedContentType = imageMetadata.format
    ? contentTypes[imageMetadata.format]
    : undefined;
  if (!detectedContentType) {
    throw new Error('Use uma imagem PNG, JPEG ou WEBP');
  }

  item.status = 'UPLOADING';
  item.updatedAt = new Date().toISOString();
  output.message = `Enviando ${item.label} para a Vertix API`;
  await saveOutput(jobId, output, 'PROCESSING');

  const ingested = await seriesCatalogService.ingestSeriesReference(
    job.seriesId!,
    {
      base64: imageBuffer.toString('base64'),
      filename: cleanText(payload.filename, 240)
        || `${item.id.replace(/[^a-zA-Z0-9_-]+/g, '-')}.png`,
      contentType: detectedContentType,
      category: item.category,
      label: item.label,
      prompt: item.prompt,
      metadata: {
        ...item.metadata,
        referenceId: item.id,
        canonical: item.canonical,
        source: 'codex-imagegen-job',
        jobId,
      },
    },
    job.createdById,
  );

  const reference = {
    id: item.id,
    label: item.label,
    category: item.category,
    description: item.description,
    prompt: item.prompt,
    canonical: item.canonical,
    publicUrl: ingested.publicUrl,
    metadata: {
      ...item.metadata,
      compiledPrompt: item.prompt,
      storageKey: ingested.storageKey,
      generatedBy: 'codex-imagegen',
      imageModel: 'gpt-image-2',
      jobId,
    },
  };
  item.status = 'COMPLETED';
  item.publicUrl = ingested.publicUrl;
  item.storageKey = ingested.storageKey;
  item.reference = reference;
  item.updatedAt = new Date().toISOString();
  delete item.error;
  const counted = recount(output);
  counted.message = `${item.label} enviada; ${counted.completed} de ${counted.total} prontas`;
  const updatedJob = await saveOutput(jobId, counted, 'PROCESSING');
  return { job: updatedJob, output: recount(counted), reference };
};

export const completeReferenceImageJob = async (jobId: number, token: string) => {
  const { job, output } = await loadAuthorizedJob(jobId, token);
  if (job.status === 'COMPLETED' || job.status === 'FAILED') {
    return { job, output };
  }
  const unfinished = output.items.filter(
    (item) => !['COMPLETED', 'FAILED'].includes(item.status),
  );
  if (unfinished.length) {
    throw new Error(`Ainda existem ${unfinished.length} referencias sem resultado`);
  }
  const counted = recount(output);
  const failedLabels = counted.items
    .filter((item) => item.status === 'FAILED')
    .map((item) => item.label);
  const failed = failedLabels.length > 0;
  counted.message = failed
    ? `${counted.completed} imagens prontas; ${counted.failed} falharam`
    : `${counted.completed} imagens geradas e enviadas para a Vertix API`;
  const updatedJob = await saveOutput(
    jobId,
    counted,
    failed ? 'FAILED' : 'COMPLETED',
    {
      completedAt: new Date(),
      errorMessage: failed
        ? `Falha nas referencias: ${failedLabels.join(', ')}`.slice(0, 4_000)
        : null,
    },
  );
  return { job: updatedJob, output: counted };
};

export const buildReferenceImageTaskPrompt = (
  apiBaseUrl: string,
  jobId: number,
  capabilityToken: string,
): string => [
  `Use $vertix-reference-images para processar agora o job ${jobId}.`,
  `API Vertix: ${apiBaseUrl.replace(/\/$/, '')}`,
  `Token do job: ${capabilityToken}`,
  'Gere as imagens reais com a skill $imagegen e envie cada arquivo para a API imediatamente quando terminar.',
  'Continue ate concluir ou registrar a falha de todas as referencias. Nao apenas escreva prompts.',
].join('\n');

export default {
  startReferenceImageJob,
  updateReferenceImageBridgeStatus,
  getReferenceImageJobManifest,
  updateReferenceImageItemStatus,
  uploadReferenceImage,
  completeReferenceImageJob,
  buildReferenceImageTaskPrompt,
};
