import fs from 'fs';
import path from 'path';
import storageService from './storage.service';
import { prisma } from './prisma';
import { paywallFieldsFromBible } from './episode-paywall.service';

type ReferenceInput = {
  url?: string;
  sourceUrl?: string;
  publicUrl?: string;
  storageKey?: string;
  imageUrl?: string;
  label?: string;
  category?: string;
  type?: string;
  contentType?: string;
  sizeBytes?: number;
  prompt?: string;
  metadata?: any;
  episodeId?: number;
};

type StoryPointInput = {
  pointType?: string;
  type?: string;
  title?: string;
  body?: any;
  description?: any;
  episodeId?: number;
  episodeNumber?: number;
  sceneNumber?: number;
  segment?: string;
  orderIndex?: number;
  metadata?: any;
};

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev';

const PLAN_FIELD_ALIASES: Record<string, string[]> = {
  seriesBible: ['seriesBible', 'series_bible', 'bible'],
  characterBible: ['characterBible', 'character_bible', 'characters', 'personagens'],
  locationBible: ['locationBible', 'location_bible', 'locations', 'ambientes', 'environments'],
  objectBible: ['objectBible', 'object_bible', 'objects', 'props', 'objetos'],
  spatialMaps: ['spatialMaps', 'spatial_maps', 'locationSpatialMaps', 'maps'],
  audioBible: ['audioBible', 'audio_bible', 'audio'],
  seasonArc: ['seasonArc', 'season_arc', 'arc'],
  episodeMap: ['episodeMap', 'episode_map', 'episodes'],
  episodeTreatments: ['episodeTreatments', 'episode_treatments', 'treatments'],
  sceneCards: ['sceneCards', 'scene_cards', 'scenes'],
  storyboardPlan: ['storyboardPlan', 'storyboard_plan', 'storyboards'],
  generationPlan: ['generationPlan', 'generation_plan', 'segments', 'generationSegments'],
  seedanceNotes: ['seedanceNotes', 'seedance_notes', 'productionNotes', 'providerNotes'],
};

const REFERENCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm']);

const jsonText = (value: any): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const parseJsonText = (value: string | null): any => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const sourcePayload = (body: any): any => {
  return body?.pipelineData || body?.productionData || body?.production || body || {};
};

const pickAliasedValue = (payload: any, aliases: string[]) => {
  for (const alias of aliases) {
    if (payload?.[alias] !== undefined) return payload[alias];
  }
  return undefined;
};

const normalizeCategory = (value?: string): string => {
  const raw = String(value || 'REFERENCE').toUpperCase();
  if (raw.includes('ENV') || raw.includes('AMBIENTE') || raw.includes('LOCATION') || raw.includes('CENARIO')) return 'ENVIRONMENT';
  if (raw.includes('OBJ') || raw.includes('PROP') || raw.includes('VEHICLE')) return 'OBJECT';
  if (raw.includes('CHAR') || raw.includes('PERSONAGEM') || raw.includes('CAST')) return 'CHARACTER';
  if (raw.includes('STORYBOARD')) return 'STORYBOARD';
  if (raw.includes('FRAME')) return 'FRAME';
  if (raw.includes('AUDIO')) return 'AUDIO';
  if (raw.includes('VIDEO')) return 'VIDEO';
  if (raw.includes('COVER')) return 'COVER';
  return raw.replace(/[^A-Z0-9_]+/g, '_') || 'REFERENCE';
};

const inferCategory = (label: string, pathHint: string): string => {
  const text = `${label} ${pathHint}`.toLowerCase();
  if (/ambiente|environment|location|cenario|cenário|room|street|set/.test(text)) return 'ENVIRONMENT';
  if (/objeto|object|prop|vehicle|item|artefato|relic|frame|pendant|gear/.test(text)) return 'OBJECT';
  if (/personagem|character|cast|voice|face|body|outfit/.test(text)) return 'CHARACTER';
  if (/storyboard|board/.test(text)) return 'STORYBOARD';
  if (/frame|last_frame|first_frame|handoff/.test(text)) return 'FRAME';
  if (/video|take|mp4|webm/.test(text)) return 'VIDEO';
  return 'REFERENCE';
};

const contentTypeFromExtension = (extension: string): string => {
  const ext = extension.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  return 'image/jpeg';
};

const filenameFromSource = (source: string, fallback: string): string => {
  try {
    const parsed = new URL(source);
    const base = path.basename(parsed.pathname);
    if (base) return base;
  } catch {}

  const localBase = path.basename(source);
  return localBase || fallback;
};

const publicRoots = (): string[] => {
  return [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'server', 'public'),
    path.resolve(__dirname, '..', '..', 'public'),
    path.resolve(__dirname, '..', '..', '..', 'public'),
  ];
};

const resolveLocalSource = (source: string): string | null => {
  if (path.isAbsolute(source) && fs.existsSync(source)) {
    return source;
  }

  if (source.startsWith('/')) {
    const clean = source.replace(/^\/+/, '').split(/[?#]/)[0];
    for (const root of publicRoots()) {
      const candidate = path.resolve(root, clean);
      if (candidate.startsWith(root) && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

const downloadReference = async (source: string) => {
  const localPath = resolveLocalSource(source);
  if (localPath) {
    const buffer = await fs.promises.readFile(localPath);
    const filename = path.basename(localPath);
    return {
      buffer,
      filename,
      contentType: contentTypeFromExtension(path.extname(filename)),
    };
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Falha ao baixar referencia ${source}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || contentTypeFromExtension(path.extname(source));
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = filenameFromSource(source, `reference_${Date.now()}${extensionFromContentType(contentType)}`);

  return { buffer, filename, contentType };
};

const extensionFromContentType = (contentType: string): string => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('mp4')) return '.mp4';
  if (normalized.includes('webm')) return '.webm';
  return '.jpg';
};

const isReferenceLikeUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const withoutQuery = trimmed.split(/[?#]/)[0];
  const extension = path.extname(withoutQuery).toLowerCase();
  const hasReferenceExtension = REFERENCE_EXTENSIONS.has(extension);
  return hasReferenceExtension && (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || path.isAbsolute(trimmed));
};

const collectUrlReferences = (value: any, pathHint = '', output: ReferenceInput[] = []): ReferenceInput[] => {
  if (typeof value === 'string') {
    if (isReferenceLikeUrl(value)) {
      output.push({
        sourceUrl: value,
        label: pathHint || 'reference',
        category: inferCategory(pathHint, value),
        metadata: { extractedFrom: pathHint },
      });
    }
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUrlReferences(item, `${pathHint}[${index}]`, output));
    return output;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ([
        'references',
        'referenceAssets',
        'reference_assets',
        'visualReferences',
        'visual_references',
        'assetList',
        'minimalAssetList',
      ].includes(key)) {
        continue;
      }
      collectUrlReferences(item, pathHint ? `${pathHint}.${key}` : key, output);
    }
  }

  return output;
};

const explicitReferences = (payload: any): ReferenceInput[] => {
  const sources = [
    payload?.references,
    payload?.referenceAssets,
    payload?.reference_assets,
    payload?.visualReferences,
    payload?.visual_references,
    payload?.assetList,
    payload?.minimalAssetList,
  ].filter(Array.isArray);

  return sources.flat().map((item: any, index: number) => {
    if (typeof item === 'string') {
      return {
        sourceUrl: item,
        label: `reference ${index + 1}`,
        category: inferCategory('', item),
      };
    }

    return {
      ...item,
      sourceUrl: item.sourceUrl || item.url || item.publicUrl || item.imageUrl,
      category: item.category || item.type || inferCategory(item.label || item.name || '', item.sourceUrl || item.url || ''),
      label: item.label || item.name || `reference ${index + 1}`,
    };
  });
};

const dedupeReferences = (references: ReferenceInput[]): ReferenceInput[] => {
  const seen = new Set<string>();
  const output: ReferenceInput[] = [];

  for (const reference of references) {
    const source = reference.sourceUrl || reference.url || reference.publicUrl || reference.imageUrl || reference.storageKey;
    if (!source) continue;
    const key = String(source).split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(reference);
  }

  return output;
};

const normalizeStoryPoint = (
  point: StoryPointInput,
  index: number,
  fallbackType = 'PIPELINE_POINT',
): StoryPointInput => {
  const body = point.body ?? point.description ?? point;
  return {
    pointType: normalizeCategory(point.pointType || point.type || fallbackType),
    title: String(point.title || point.type || point.pointType || `Ponto ${index + 1}`).slice(0, 180),
    body,
    episodeId: point.episodeId,
    episodeNumber: point.episodeNumber,
    sceneNumber: point.sceneNumber,
    segment: point.segment,
    orderIndex: point.orderIndex ?? index,
    metadata: point.metadata,
  };
};

const deriveStoryPoints = (payload: any): StoryPointInput[] => {
  const points: StoryPointInput[] = [];
  const explicit = payload?.storyPoints || payload?.story_points || payload?.points || payload?.pontos;
  if (Array.isArray(explicit)) {
    explicit.forEach((point, index) => points.push(normalizeStoryPoint(point, index)));
  }

  const episodeMap = pickAliasedValue(payload, PLAN_FIELD_ALIASES.episodeMap);
  if (Array.isArray(episodeMap)) {
    episodeMap.forEach((episode: any, index: number) => {
      points.push(normalizeStoryPoint({
        pointType: 'EPISODE_MAP',
        title: episode.title || `Episodio ${episode.episode || index + 1}`,
        body: episode,
        episodeNumber: episode.episode || episode.episodeNumber,
        orderIndex: points.length,
      }, points.length, 'EPISODE_MAP'));
    });
  }

  const sceneCards = pickAliasedValue(payload, PLAN_FIELD_ALIASES.sceneCards);
  if (Array.isArray(sceneCards)) {
    sceneCards.forEach((scene: any) => {
      points.push(normalizeStoryPoint({
        pointType: 'SCENE_CARD',
        title: scene.title || `Cena ${scene.scene || scene.sceneNumber || points.length + 1}`,
        body: scene,
        episodeNumber: scene.episode || scene.episodeNumber,
        sceneNumber: scene.scene || scene.sceneNumber,
        orderIndex: points.length,
      }, points.length, 'SCENE_CARD'));
    });
  }

  const generationPlan = pickAliasedValue(payload, PLAN_FIELD_ALIASES.generationPlan);
  if (Array.isArray(generationPlan)) {
    generationPlan.forEach((segment: any) => {
      const segmentSlot = segment.metadata?.productionSlot || segment.productionSlot || segment.currentSlot || segment.outputSlot;
      points.push(normalizeStoryPoint({
        pointType: 'GENERATION_SEGMENT',
        title: segment.segment || segment.id || `Segmento ${points.length + 1}`,
        body: segment,
        episodeNumber: segment.episode || segment.episodeNumber,
        sceneNumber: segment.scene || segment.sceneNumber,
        segment: segment.segment || segment.id,
        metadata: segment.metadata || (segmentSlot ? { productionSlot: String(segmentSlot) } : undefined),
        orderIndex: points.length,
      }, points.length, 'GENERATION_SEGMENT'));
    });
  }

  const prompts = payload?.prompts;
  if (prompts && typeof prompts === 'object') {
    for (const [key, prompt] of Object.entries(prompts)) {
      if (typeof prompt !== 'string' || !prompt.trim()) continue;
      points.push(normalizeStoryPoint({
        pointType: 'SEEDANCE_PROMPT',
        title: key,
        body: prompt,
        orderIndex: points.length,
      }, points.length, 'SEEDANCE_PROMPT'));
    }
  }

  return points;
};

const dedupeStoryPoints = (points: StoryPointInput[]): StoryPointInput[] => {
  const seen = new Set<string>();
  const output: StoryPointInput[] = [];

  for (const point of points) {
    const pointType = point.pointType || point.type || '';
    let key = [
      pointType,
      point.title || '',
      point.episodeNumber ?? '',
      point.sceneNumber ?? '',
      point.segment || '',
    ].join('|');

    if (pointType === 'EPISODE_MAP' && point.episodeNumber !== undefined) {
      key = `${pointType}|${point.episodeNumber}`;
    } else if (pointType === 'SCENE_CARD' && (point.episodeNumber !== undefined || point.sceneNumber !== undefined)) {
      key = `${pointType}|${point.episodeNumber ?? ''}|${point.sceneNumber ?? ''}`;
    } else if (pointType === 'GENERATION_SEGMENT' && (point.episodeNumber !== undefined || point.segment)) {
      key = `${pointType}|${point.episodeNumber ?? ''}|${point.segment || point.title || ''}`;
    } else if (pointType === 'SEEDANCE_PROMPT' && point.title) {
      key = `${pointType}|${point.title}`;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(point);
  }

  return output;
};

const serializePlanFields = (payload: any) => {
  const data: Record<string, string | undefined> = {};

  for (const [field, aliases] of Object.entries(PLAN_FIELD_ALIASES)) {
    data[field] = jsonText(pickAliasedValue(payload, aliases));
  }

  return data;
};

const createReferenceAsset = async (
  seriesId: number,
  productionPlanId: number,
  createdById: number,
  reference: ReferenceInput,
) => {
  const source = reference.sourceUrl || reference.url || reference.publicUrl || reference.imageUrl || '';
  const category = normalizeCategory(reference.category || reference.type || inferCategory(reference.label || '', source));
  const label = String(reference.label || category).slice(0, 180);
  let publicUrl = reference.publicUrl || '';
  let storageKey = reference.storageKey || '';
  let sizeBytes: number | undefined = reference.sizeBytes;
  let contentType: string | undefined = reference.contentType;
  let originalSourceUrl: string | undefined;

  if (!storageKey && publicUrl.startsWith(`${R2_PUBLIC_URL}/`)) {
    storageKey = publicUrl.slice(R2_PUBLIC_URL.length + 1);
  }

  if (!publicUrl && storageKey) {
    publicUrl = storageService.getPublicUrl(storageKey);
  }

  if (!contentType && (publicUrl || source || storageKey)) {
    const contentHint = (publicUrl || source || storageKey).split(/[?#]/)[0];
    contentType = contentTypeFromExtension(path.extname(contentHint));
  }

  if (!storageKey || !publicUrl) {
    if (!source) {
      throw new Error(`Referencia sem URL: ${label}`);
    }

    const downloaded = await downloadReference(source);
    const uploaded = await storageService.uploadReferenceAsset(
      downloaded.buffer,
      downloaded.filename,
      category,
      seriesId,
      downloaded.contentType,
    );

    originalSourceUrl = source;
    publicUrl = uploaded.publicUrl;
    storageKey = uploaded.key;
    sizeBytes = uploaded.size;
    contentType = downloaded.contentType;
  }

  const metadata = reference.metadata && typeof reference.metadata === 'object'
    ? reference.metadata
    : reference.metadata
      ? { value: reference.metadata }
      : {};

  return prisma.seriesReferenceAsset.create({
    data: {
      seriesId,
      episodeId: reference.episodeId,
      productionPlanId,
      category,
      label,
      sourceUrl: publicUrl,
      storageKey,
      publicUrl,
      contentType,
      sizeBytes,
      prompt: jsonText(reference.prompt),
      metadata: jsonText({
        ...metadata,
        originalSourceUrl: originalSourceUrl && originalSourceUrl !== publicUrl
          ? originalSourceUrl
          : undefined,
      }),
      createdById,
    },
  });
};

const metadataObject = (metadata: any): Record<string, any> => {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const referenceProductionSlot = (reference: ReferenceInput): string | null => {
  const metadata = metadataObject(reference.metadata);
  const slot = metadata.productionSlot || metadata.currentSlot || metadata.outputSlot;
  return slot ? String(slot).trim() : null;
};

const storyPointProductionSlot = (point: StoryPointInput): string | null => {
  const metadata = metadataObject(point.metadata);
  const slot = metadata.productionSlot || metadata.currentSlot || metadata.outputSlot;
  return slot ? String(slot).trim() : null;
};

const replaceCurrentRunReferences = async (
  productionPlanId: number,
  references: ReferenceInput[],
) => {
  const slots = [...new Set(references.map(referenceProductionSlot).filter(Boolean))] as string[];
  if (slots.length === 0) return 0;

  const labels = references
    .filter((reference) => referenceProductionSlot(reference))
    .map((reference) => reference.label)
    .filter(Boolean) as string[];

  const or = [
    ...labels.map((label) => ({ label })),
    ...slots.map((slot) => ({ metadata: { contains: `"productionSlot":"${slot}"` } })),
    ...slots.map((slot) => ({ metadata: { contains: `"currentSlot":"${slot}"` } })),
    ...slots.map((slot) => ({ metadata: { contains: `"outputSlot":"${slot}"` } })),
  ];

  if (or.length === 0) return 0;

  const result = await prisma.seriesReferenceAsset.deleteMany({
    where: {
      productionPlanId,
      OR: or,
    },
  });

  return result.count;
};

const replaceCurrentRunStoryPoints = async (
  productionPlanId: number,
  storyPoints: StoryPointInput[],
) => {
  const slots = [...new Set(storyPoints.map(storyPointProductionSlot).filter(Boolean))] as string[];
  const titles = storyPoints
    .filter((point) => storyPointProductionSlot(point))
    .map((point) => point.title)
    .filter(Boolean) as string[];

  const or = [
    ...titles.map((title) => ({ title })),
    ...slots.map((slot) => ({ metadata: { contains: `"productionSlot":"${slot}"` } })),
    ...slots.map((slot) => ({ metadata: { contains: `"currentSlot":"${slot}"` } })),
    ...slots.map((slot) => ({ metadata: { contains: `"outputSlot":"${slot}"` } })),
  ];

  if (or.length === 0) return 0;

  const result = await prisma.seriesStoryPoint.deleteMany({
    where: {
      productionPlanId,
      OR: or,
    },
  });

  return result.count;
};

export const createDraftSeries = async (
  userId: number,
  body: any,
) => {
  const title = String(body?.title || '').trim();
  if (!title) {
    throw new Error('title e obrigatorio');
  }

  return prisma.series.create({
    data: {
      title,
      description: String(body?.description || ''),
      coverUrl: String(body?.coverUrl || ''),
      thumbnailUrl: body?.thumbnailUrl || null,
      genre: String(body?.genre || 'Drama'),
      tags: Array.isArray(body?.tags) ? JSON.stringify(body.tags) : body?.tags || null,
      totalEpisodes: Number(body?.totalEpisodes || body?.episodeCount || 0),
      createdById: userId,
      status: String(body?.status || 'DRAFT'),
      isAiGenerated: body?.isAiGenerated !== false,
      ...paywallFieldsFromBible(body?.seriesBible || body?.series_bible, Number(body?.totalEpisodes || body?.episodeCount || 0)),
    },
  });
};

export const saveSeriesProductionPlan = async (
  seriesId: number,
  body: any,
  userId: number,
) => {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true },
  });

  if (!series) {
    throw new Error('Serie nao encontrada');
  }

  const payload = sourcePayload(body);
  const source = body?.source || payload?.source || 'seedance-series-pipeline';
  const replaceExisting = body?.replaceExisting !== undefined
    ? body.replaceExisting !== false
    : source !== 'vertix-app';
  const planFields = serializePlanFields(payload);

  const plan = await prisma.seriesProductionPlan.upsert({
    where: { seriesId },
    create: {
      seriesId,
      source,
      ...planFields,
      rawPayload: jsonText(body),
      createdById: userId,
      updatedById: userId,
    },
    update: {
      source,
      ...planFields,
      rawPayload: jsonText(body),
      updatedById: userId,
    },
  });

  const bible = parseJsonText(plan.seriesBible);
  const episodeCount = Number(payload?.totalEpisodes || payload?.episodeCount || 0);
  const paywall = paywallFieldsFromBible(bible, episodeCount);
  await prisma.series.update({
    where: { id: seriesId },
    data: {
      ...(episodeCount > 0 ? { totalEpisodes: episodeCount } : {}),
      freeEpisodeCount: paywall.freeEpisodeCount,
      episodeUnlockCost: paywall.episodeUnlockCost,
    },
  });

  const references = dedupeReferences([
    ...explicitReferences(payload),
    ...(body?.collectImplicitReferences === false || payload?.collectImplicitReferences === false
      ? []
      : collectUrlReferences(payload)),
  ]);

  const storyPoints = dedupeStoryPoints(deriveStoryPoints(payload));

  let replacedReferences = 0;
  let replacedStoryPoints = 0;

  if (replaceExisting) {
    await prisma.seriesStoryPoint.deleteMany({ where: { productionPlanId: plan.id } });
    await prisma.seriesReferenceAsset.deleteMany({ where: { productionPlanId: plan.id } });
  } else if (body?.replaceCurrentRun === true || payload?.replaceCurrentRun === true) {
    replacedReferences = await replaceCurrentRunReferences(plan.id, references);
    replacedStoryPoints = await replaceCurrentRunStoryPoints(plan.id, storyPoints);
  }

  const referenceResults: any[] = [];
  const referenceErrors: any[] = [];

  for (const reference of references) {
    try {
      referenceResults.push(await createReferenceAsset(seriesId, plan.id, userId, reference));
    } catch (error: any) {
      referenceErrors.push({
        label: reference.label,
        sourceUrl: reference.sourceUrl || reference.url || reference.publicUrl || reference.imageUrl,
        message: error.message,
      });
    }
  }

  if (storyPoints.length > 0) {
    await prisma.seriesStoryPoint.createMany({
      data: storyPoints.map((point, index) => ({
        seriesId,
        episodeId: point.episodeId,
        productionPlanId: plan.id,
        pointType: point.pointType || 'PIPELINE_POINT',
        title: point.title || `Ponto ${index + 1}`,
        body: jsonText(point.body) || '',
        episodeNumber: point.episodeNumber,
        sceneNumber: point.sceneNumber,
        segment: point.segment,
        orderIndex: point.orderIndex ?? index,
        metadata: jsonText(point.metadata),
      })),
    });
  }

  return {
    planId: plan.id,
    referencesSaved: referenceResults.length,
    referencesReplaced: replacedReferences,
    referenceErrors,
    storyPointsSaved: storyPoints.length,
    storyPointsReplaced: replacedStoryPoints,
  };
};

export const getSeriesProductionPlan = async (seriesId: number) => {
  const plan = await prisma.seriesProductionPlan.findUnique({
    where: { seriesId },
    include: {
      referenceAssets: {
        orderBy: { createdAt: 'desc' },
      },
      storyPoints: {
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!plan) return null;

  return {
    ...plan,
    seriesBible: parseJsonText(plan.seriesBible),
    characterBible: parseJsonText(plan.characterBible),
    locationBible: parseJsonText(plan.locationBible),
    objectBible: parseJsonText(plan.objectBible),
    spatialMaps: parseJsonText(plan.spatialMaps),
    audioBible: parseJsonText(plan.audioBible),
    seasonArc: parseJsonText(plan.seasonArc),
    episodeMap: parseJsonText(plan.episodeMap),
    episodeTreatments: parseJsonText(plan.episodeTreatments),
    sceneCards: parseJsonText(plan.sceneCards),
    storyboardPlan: parseJsonText(plan.storyboardPlan),
    generationPlan: parseJsonText(plan.generationPlan),
    seedanceNotes: parseJsonText(plan.seedanceNotes),
    rawPayload: parseJsonText(plan.rawPayload),
    referenceAssets: plan.referenceAssets.map((reference) => ({
      ...reference,
      metadata: parseJsonText(reference.metadata),
      prompt: parseJsonText(reference.prompt),
    })),
    storyPoints: plan.storyPoints.map((point) => ({
      ...point,
      body: parseJsonText(point.body),
      metadata: parseJsonText(point.metadata),
    })),
  };
};

export default {
  createDraftSeries,
  saveSeriesProductionPlan,
  getSeriesProductionPlan,
};
