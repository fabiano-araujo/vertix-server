type JsonMap = { [key: string]: any };

const asMap = (value: unknown): JsonMap =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonMap
    : {};

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
