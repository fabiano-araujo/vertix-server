type JsonMap = { [key: string]: any };

const asMap = (value: unknown): JsonMap =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonMap
    : {};

const asList = (value: unknown): JsonMap[] =>
  Array.isArray(value)
    ? value.filter((item): item is JsonMap => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];

/** Drop Flutter pipeline chatter so the bible stage is not told to write cards. */
export const sanitizeOutlineInstruction = (instruction?: string): string => {
  const raw = String(instruction || '').trim();
  if (!raw) return '';
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const n = trimmed.toLowerCase();
    const pipeline =
      /mapa completo da temporada/.test(n) ||
      /primeiro lote de cart/.test(n) ||
      /n[aã]o gaste no ep inicial/.test(n) ||
      /^modo do roteirista:/.test(n) ||
      /^dura[cç][aã]o do /.test(n) ||
      /^dura[cç][aã]o dos demais/.test(n) ||
      (/^(gere|depois gere|reescreva)\b/.test(n) &&
        /(contrato|mapa|cart[oõ]es|paywall|esbo[cç]o)/.test(n));
    if (pipeline) continue;
    const key = n.replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  const ideaLine = kept.find((line) => /^ideia do usuario:/i.test(line));
  const idea = ideaLine?.replace(/^ideia do usuario:\s*/i, '').trim().toLowerCase();
  return kept
    .filter((line) => !idea || line.trim().toLowerCase() !== idea)
    .join('\n');
};

export const compactProjectForBible = (project: JsonMap): JsonMap => {
  const bible = asMap(project.seriesBible);
  return {
    title: project.title,
    genre: project.genre || bible.genre,
    targetEpisodeCount: project.targetEpisodeCount,
    seriesBible: {
      language: bible.language,
      rating: bible.rating,
      visual_style: bible.visual_style,
      genre: bible.genre,
      background: bible.background,
      trope: bible.trope,
      first_episode_duration_seconds: bible.first_episode_duration_seconds,
      episode_duration_seconds: bible.episode_duration_seconds,
      logline: bible.logline || undefined,
      protagonist: bible.protagonist || undefined,
      opposing_force: bible.opposing_force || undefined,
    },
  };
};

export const RECURRING_LOCATION_KINDS = [
  'home',
  'workplace',
  'hangout',
  'landmark',
  'institution',
  'territory',
  'threshold',
] as const;

const GENERIC_STREET_NAME =
  /^(uma |the )?(rua|street|calçada|sidewalk|beco|alley|avenida|avenue|estrada|road)(\s+(qualquer|genérica|generica|anônima|anonima|random|desconhecida))?$/i;

/** One-off sidewalks are shot in the take, not saved as LOCATION_MASTER. */
export const isGenericStreetLocation = (item: JsonMap): boolean => {
  const kind = String(item.kind || item.location_kind || '').trim().toLowerCase();
  if ((RECURRING_LOCATION_KINDS as readonly string[]).includes(kind)) return false;
  if (kind === 'street' || kind === 'generic' || kind === 'transient') return true;
  const name = String(item.name || item.label || '').trim();
  return GENERIC_STREET_NAME.test(name);
};

export const filterRecurringEnvironments = (value: unknown): JsonMap[] =>
  asList(value).filter((item) => !isGenericStreetLocation(item));

const isDefaultLook = (look: JsonMap): boolean =>
  look.primary === true ||
  String(look.kind || '').toLowerCase() === 'default' ||
  String(look.id || '').toLowerCase() === 'default';

const lookReferenceFromCharacter = (character: JsonMap, look: JsonMap): JsonMap | null => {
  const characterId = String(character.reference_id || character.id || '').trim();
  const lookId = String(look.id || '').trim();
  if (!characterId || !lookId || isDefaultLook(look)) return null;
  const name = String(character.name || character.label || characterId).trim();
  const lookLabel = String(look.label || lookId).trim();
  const wardrobe = String(look.wardrobe || '').trim();
  const prompt = String(look.prompt || '').trim()
    || `Keep the character from image 1 unchanged. Change the outfit to: ${wardrobe}`;
  return {
    id: `${characterId}-look-${lookId}`,
    label: `${name}-${lookLabel}`,
    category: 'CHARACTER_LOOK',
    description: prompt,
    canonical: true,
    metadata: {
      parent_character_id: characterId,
      look_id: lookId,
      look_kind: look.kind || 'wardrobe',
      needed_because: look.needed_because,
      wardrobe,
      outfit_lock: wardrobe,
      prompt,
    },
  };
};

const sheetDescription = (item: JsonMap): string =>
  String(item.appearance || item.description || '').trim();

const referenceFromSheet = (
  item: JsonMap,
  category: 'CHARACTER_MASTER' | 'LOCATION_MASTER' | 'PROP_MASTER',
): JsonMap | null => {
  const id = String(item.reference_id || item.id || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(item.name || item.label || id).trim() || id,
    category,
    description: sheetDescription(item),
    canonical: true,
    metadata: item,
  };
};

/** Image masters are derived from sheets so the model does not write the cast twice. */
export const referencesFromBibleSheets = (
  patch: JsonMap,
  modelReferences: unknown = [],
): JsonMap[] => {
  const byId = new Map<string, JsonMap>();
  const remember = (item: JsonMap | null) => {
    if (!item) return;
    const id = String(item.id || '').trim();
    if (!id) return;
    const previous = byId.get(id);
    if (!previous) {
      byId.set(id, item);
      return;
    }
    byId.set(id, {
      ...previous,
      ...item,
      description: String(item.description || previous.description || ''),
      metadata: {
        ...asMap(previous.metadata),
        ...asMap(item.metadata),
      },
    });
  };
  for (const item of asList(modelReferences)) {
    const id = String(item.id || item.reference_id || '').trim();
    if (!id) continue;
    remember({
      id,
      label: String(item.label || item.name || id),
      category: String(item.category || 'CHARACTER_MASTER'),
      description: String(item.description || item.appearance || ''),
      canonical: item.canonical !== false,
      metadata: asMap(item.metadata).id ? asMap(item.metadata) : item,
    });
  }
  for (const item of asList(patch.characters)) {
    remember(referenceFromSheet(item, 'CHARACTER_MASTER'));
    for (const look of asList(item.looks)) {
      remember(lookReferenceFromCharacter(item, look));
    }
  }
  for (const item of filterRecurringEnvironments(patch.environments)) {
    remember(referenceFromSheet(item, 'LOCATION_MASTER'));
  }
  for (const item of asList(patch.props)) {
    remember(referenceFromSheet(item, 'PROP_MASTER'));
  }
  return [...byId.values()];
};
