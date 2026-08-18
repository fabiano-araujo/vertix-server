import path from 'path';
import { prisma } from './prisma';
import storageService from './storage.service';

type CatalogAssetInput = {
  base64?: string;
  data?: string;
  dataUrl?: string;
  sourceUrl?: string;
  publicUrl?: string;
  imageUrl?: string;
  url?: string;
  storageKey?: string;
  filename?: string;
  contentType?: string;
  category?: string;
  label?: string;
  prompt?: unknown;
  metadata?: unknown;
};

type SyncCatalogPayload = {
  series?: Record<string, any>;
  cover?: CatalogAssetInput;
  coverAsset?: CatalogAssetInput;
  appCover?: CatalogAssetInput;
  thumbnail?: CatalogAssetInput;
  thumbnailAsset?: CatalogAssetInput;
  appThumbnail?: CatalogAssetInput;
  referenceAssets?: CatalogAssetInput[];
  cacheVersion?: string;
  replaceExistingCatalogAssets?: boolean;
  [key: string]: any;
};

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const jsonText = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const extensionFromContentType = (contentType?: string): string => {
  const normalized = String(contentType || '').toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  return '.jpg';
};

const filenameFromUrl = (url: string, fallback: string): string => {
  try {
    const parsed = new URL(url);
    const name = path.basename(parsed.pathname);
    return name && name.includes('.') ? name : fallback;
  } catch {
    return fallback;
  }
};

const stripQuery = (url: string): string => url.split('?')[0];

const withCacheVersion = (url: string, cacheVersion: string): string => {
  const cleanUrl = stripQuery(url);
  return `${cleanUrl}?v=${encodeURIComponent(cacheVersion)}`;
};

const inferStorageKey = (publicUrl?: string): string | undefined => {
  if (!publicUrl || !R2_PUBLIC_URL) return undefined;
  const cleanUrl = stripQuery(publicUrl);
  const prefix = `${R2_PUBLIC_URL}/`;
  if (!cleanUrl.startsWith(prefix)) return undefined;
  return cleanUrl.slice(prefix.length);
};

const decodeBase64Asset = (
  input: CatalogAssetInput,
  fallbackContentType: string,
): { buffer: Buffer; contentType: string } | null => {
  const raw = input.base64 || input.dataUrl || input.data;
  if (!raw) return null;

  const match = raw.match(/^data:([^;]+);base64,(.*)$/);
  const contentType = input.contentType || match?.[1] || fallbackContentType;
  const base64 = match?.[2] || raw;
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw new Error('Asset base64 vazio ou invalido');
  }

  return { buffer, contentType };
};

const downloadAsset = async (
  url: string,
  fallbackContentType: string,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar asset ${url}: ${response.status} ${response.statusText}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || fallbackContentType,
  };
};

const resolveAsset = async (
  seriesId: number,
  input: CatalogAssetInput,
  defaultCategory: string,
  defaultLabel: string,
) => {
  const category = input.category || defaultCategory;
  const label = input.label || defaultLabel;
  const fallbackContentType = input.contentType || 'image/png';
  const sourceUrl = input.sourceUrl || input.imageUrl || input.url || input.publicUrl;
  let storageKey = input.storageKey || inferStorageKey(input.publicUrl);
  let publicUrl = input.publicUrl ? stripQuery(input.publicUrl) : undefined;
  let sizeBytes: number | undefined;
  let contentType = input.contentType;

  if (!storageKey || !publicUrl) {
    const decoded = decodeBase64Asset(input, fallbackContentType);
    const downloaded = !decoded && sourceUrl
      ? await downloadAsset(sourceUrl, fallbackContentType)
      : null;
    const asset = decoded || downloaded;

    if (!asset) {
      throw new Error(`Asset ${label} precisa de base64, publicUrl, imageUrl ou sourceUrl`);
    }

    const filename = input.filename
      || (sourceUrl
        ? filenameFromUrl(sourceUrl, `${category}${extensionFromContentType(asset.contentType)}`)
        : `${category}${extensionFromContentType(asset.contentType)}`);

    const uploaded = await storageService.uploadReferenceAsset(
      asset.buffer,
      filename,
      category,
      seriesId,
      asset.contentType,
    );

    storageKey = uploaded.key;
    publicUrl = uploaded.publicUrl;
    sizeBytes = uploaded.size;
    contentType = asset.contentType;
  }

  return {
    category,
    label,
    sourceUrl,
    storageKey,
    publicUrl,
    sizeBytes,
    contentType,
    prompt: input.prompt,
    metadata: input.metadata,
  };
};

const buildSeriesUpdate = (body: SyncCatalogPayload) => {
  const source = body.series || body;
  const data: Record<string, any> = {};

  for (const field of ['title', 'description', 'genre', 'status']) {
    if (source[field] !== undefined) data[field] = source[field];
  }

  if (source.totalEpisodes !== undefined) {
    data.totalEpisodes = Number(source.totalEpisodes);
  }

  if (source.isAiGenerated !== undefined) {
    data.isAiGenerated = Boolean(source.isAiGenerated);
  }

  if (source.tags !== undefined) {
    data.tags = Array.isArray(source.tags) ? JSON.stringify(source.tags) : source.tags;
  }

  return data;
};

const ensureProductionPlan = async (seriesId: number, userId: number) => {
  const existing = await prisma.seriesProductionPlan.findUnique({
    where: { seriesId },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.seriesProductionPlan.create({
    data: {
      seriesId,
      source: 'seedance-series-pipeline',
      createdById: userId,
      updatedById: userId,
      rawPayload: JSON.stringify({
        source: 'catalog-assets-api',
        note: 'Plano criado automaticamente ao sincronizar assets de catalogo.',
      }),
    },
    select: { id: true },
  });
};

export const syncSeriesCatalogAssets = async (
  seriesId: number,
  payload: SyncCatalogPayload,
  userId: number,
) => {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true, createdById: true },
  });

  if (!series) {
    throw new Error('Serie nao encontrada');
  }

  const cacheVersion = payload.cacheVersion
    || new Date().toISOString().replace(/\D/g, '').slice(0, 12);
  const plan = await ensureProductionPlan(seriesId, userId);
  const seriesUpdate = buildSeriesUpdate(payload);
  const references: any[] = [];
  const coverInput = payload.cover || payload.coverAsset || payload.appCover;
  const thumbnailInput = payload.thumbnail || payload.thumbnailAsset || payload.appThumbnail;

  if (coverInput) {
    const cover = await resolveAsset(
      seriesId,
      coverInput,
      'APP_COVER',
      'APP_COVER - catalog poster',
    );
    seriesUpdate.coverUrl = withCacheVersion(cover.publicUrl, cacheVersion);
    references.push({ ...cover, publicUrl: seriesUpdate.coverUrl });
  }

  if (thumbnailInput) {
    const thumbnail = await resolveAsset(
      seriesId,
      thumbnailInput,
      'APP_THUMBNAIL',
      'APP_THUMBNAIL - catalog thumbnail',
    );
    seriesUpdate.thumbnailUrl = withCacheVersion(thumbnail.publicUrl, cacheVersion);
    references.push({ ...thumbnail, publicUrl: seriesUpdate.thumbnailUrl });
  }

  for (const reference of payload.referenceAssets || []) {
    const resolved = await resolveAsset(
      seriesId,
      reference,
      reference.category || 'REFERENCE',
      reference.label || 'REFERENCE - production asset',
    );
    references.push({
      ...resolved,
      publicUrl: withCacheVersion(resolved.publicUrl, cacheVersion),
    });
  }

  if (!Object.keys(seriesUpdate).length && !references.length) {
    throw new Error('Envie pelo menos um campo da serie, cover, thumbnail ou referenceAssets');
  }

  const replaceExisting = payload.replaceExistingCatalogAssets !== false;
  const replaceCategories = references
    .map((reference) => reference.category)
    .filter((category) => ['APP_COVER', 'APP_THUMBNAIL'].includes(category));

  const result = await prisma.$transaction(async (tx) => {
    if (replaceExisting && replaceCategories.length) {
      await tx.seriesReferenceAsset.deleteMany({
        where: {
          seriesId,
          category: { in: Array.from(new Set(replaceCategories)) },
        },
      });
    }

    let updatedSeries: any = null;
    if (Object.keys(seriesUpdate).length) {
      updatedSeries = await tx.series.update({
        where: { id: seriesId },
        data: seriesUpdate,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              username: true,
              photo: true,
            },
          },
          _count: {
            select: { episodes: true, referenceAssets: true },
          },
        },
      });
    }

    if (references.length) {
      await tx.seriesReferenceAsset.createMany({
        data: references.map((reference) => ({
          seriesId,
          productionPlanId: plan.id,
          category: reference.category,
          label: String(reference.label).slice(0, 180),
          sourceUrl: reference.sourceUrl || reference.publicUrl,
          storageKey: reference.storageKey,
          publicUrl: reference.publicUrl,
          contentType: reference.contentType,
          sizeBytes: reference.sizeBytes,
          prompt: jsonText(reference.prompt),
          metadata: jsonText({
            ...(typeof reference.metadata === 'object' && reference.metadata !== null
              ? reference.metadata as Record<string, unknown>
              : { metadata: reference.metadata }),
            cacheVersion,
          }),
          createdById: userId,
        })),
      });
    }

    return {
      series: updatedSeries,
      assets: references,
      cacheVersion,
    };
  });

  return result;
};

export const ingestSeriesReference = async (
  seriesId: number,
  payload: CatalogAssetInput & { replaceExisting?: boolean },
  userId: number,
) => {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true },
  });
  if (!series) {
    throw new Error('Serie nao encontrada');
  }

  const plan = await ensureProductionPlan(seriesId, userId);
  const resolved = await resolveAsset(
    seriesId,
    payload,
    payload.category || 'REFERENCE',
    payload.label || 'REFERENCE',
  );

  const created = await prisma.seriesReferenceAsset.create({
    data: {
      seriesId,
      productionPlanId: plan.id,
      category: resolved.category,
      label: String(resolved.label).slice(0, 180),
      sourceUrl: resolved.sourceUrl || resolved.publicUrl,
      storageKey: resolved.storageKey,
      publicUrl: resolved.publicUrl,
      contentType: resolved.contentType,
      sizeBytes: resolved.sizeBytes,
      prompt: jsonText(resolved.prompt ?? payload.prompt),
      metadata: jsonText({
        ...(typeof payload.metadata === 'object' && payload.metadata !== null
          ? payload.metadata as Record<string, unknown>
          : { metadata: payload.metadata }),
        source: 'vertix-api-reference',
      }),
      createdById: userId,
    },
  });

  return {
    id: created.id,
    seriesId,
    category: created.category,
    label: created.label,
    publicUrl: created.publicUrl,
    storageKey: created.storageKey,
    contentType: created.contentType,
    prompt: payload.prompt,
    metadata: payload.metadata,
  };
};

export default {
  syncSeriesCatalogAssets,
  ingestSeriesReference,
};
