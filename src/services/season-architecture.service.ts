export type PrimaryConversion = 'unlock' | 'next_view';

export interface BeatEngine {
  duration_seconds: number;
  hook: string;
  friction: string;
  spike: string;
  button: string;
  freeze_frame_check: string;
  peak_cut_rule: string;
}

export interface RetentionProfile {
  distribution_profile: string;
  episode_count: number;
  first_episode_duration_seconds: number;
  other_episode_duration_seconds: number;
  episode_duration_min_seconds: number;
  episode_duration_max_seconds: number;
  free_episode_count: number;
  paywall_episode: number | null;
  payoff_after_paywall_episode: number | null;
  primary_conversion: PrimaryConversion;
  acquisition_clip_seconds: string;
  central_question_payoff_window: string;
  beat_engine_first: BeatEngine;
  beat_engine_other: BeatEngine;
}

export interface SeasonBlockPlan {
  id: string;
  start: number;
  end: number;
  episodes: string;
  role: string;
  conversion_role: string;
  must_not_resolve: string[];
}

export interface ReservedReveal {
  id: string;
  fact: string;
  earliest_episode: number;
  payoff_episode: number;
  why_late?: string;
}

export interface EpisodeSpineSlot {
  episode: number;
  block_id: string;
  function: string;
  dominant_question: string;
  promise_paid: string | null;
  promise_opened: string | null;
  reserved_ids_locked: string[];
  pressure_type: string;
  relationship_shift: string;
  conversion_role: string;
  must_not: string;
}

export const SPINE_CHUNK_SIZE = 12;
export const DEFAULT_OUTLINE_BATCH_SIZE = 5;

export interface OutlineBatchRange {
  fromEpisode: number;
  throughEpisode: number;
  targetEpisodeCount: number;
  remaining: number;
  canContinue: boolean;
  nextFromEpisode: number | null;
  batchSize: number;
  isFullSeason: boolean;
}

const asMap = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const asPositiveInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

export const EPISODE_DURATION_MIN_SECONDS = 90;
export const EPISODE_DURATION_MAX_SECONDS = 120;
export const EPISODE_DURATION_DEFAULT_SECONDS = 105;

export const clampEpisodeDuration = (
  value: unknown,
  min = EPISODE_DURATION_MIN_SECONDS,
  max = EPISODE_DURATION_MAX_SECONDS,
): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return EPISODE_DURATION_DEFAULT_SECONDS;
  return Math.min(max, Math.max(min, Math.round(n)));
};

export const episodeDurationSeconds = (
  episodeNumber: number,
  firstDuration: number,
  otherDuration: number,
): number => (episodeNumber === 1 ? firstDuration : otherDuration);

export const beatEngineForDuration = (seconds: number): BeatEngine => {
  const duration = Math.max(20, Math.round(seconds || 60));
  const hookEnd = Math.min(15, Math.max(8, Math.round(duration * 0.2)));
  const buttonLen = Math.min(10, Math.max(5, Math.round(duration * 0.1)));
  const buttonStart = duration - buttonLen;
  const frictionEnd = Math.round(hookEnd + (buttonStart - hookEnd) * 0.55);
  return {
    duration_seconds: duration,
    hook: `0-${hookEnd}s`,
    friction: `${hookEnd}-${frictionEnd}s`,
    spike: `${frictionEnd}-${buttonStart}s`,
    button: `${buttonStart}-${duration}s`,
    freeze_frame_check: '3s',
    peak_cut_rule: 'Cut 2s early on the unanswered question, never on explanation.',
  };
};

/**
 * Unique writing kernel for OpenRouter/DeepSeek. Inject once per outline/script call.
 * Do not paste vertical-drama-writer SKILL.md here.
 */
export const STORY_KERNEL = [
  'STORY KERNEL (system-owned; do not restate or waive):',
  '3s freeze-frame = irreversible act in progress. Ban arrival/return/new-life openings and titles like "O Retorno". 15s = who/want/obstacle/risk.',
  'One exclusive job per EP; adjacent pressure_type must differ. Pay the previous hook, then raise cost. Cut on the unanswered question.',
  'Plant viewer_dramatic_irony when it names an episode. Funnel proves; central question waits for the ceiling. Paywall asks; +1-2 pays and opens a bigger problem. Honor LOCKED_REVEALS and must_not.',
].join('\n');

/** @deprecated Use STORY_KERNEL. Kept so older imports keep compiling. */
export const PHONE_RETENTION_RULES = STORY_KERNEL;

export const buildRetentionProfile = (input: {
  episodeCount: number;
  firstDuration?: number;
  otherDuration?: number;
  distributionProfile?: string;
  freeEpisodeCount?: number | null;
  paywallPosition?: number | null;
}): RetentionProfile => {
  const episodeCount = Math.max(1, Math.trunc(input.episodeCount || 1));
  const firstDuration = asPositiveInt(input.firstDuration, EPISODE_DURATION_MIN_SECONDS);
  const otherDuration = asPositiveInt(input.otherDuration, EPISODE_DURATION_MAX_SECONDS);
  const distribution = String(input.distributionProfile || 'app_native').trim()
    || 'app_native';
  const social = distribution === 'social_serialized';

  let freeCount: number;
  const requestedFree = input.freeEpisodeCount == null
    ? null
    : asPositiveInt(input.freeEpisodeCount, 0);
  if (requestedFree && requestedFree > 0) {
    freeCount = Math.min(episodeCount, requestedFree);
  } else if (social || episodeCount <= 3) {
    freeCount = episodeCount;
  } else if (episodeCount <= 8) {
    freeCount = Math.max(2, Math.floor(episodeCount * 0.4));
  } else if (episodeCount <= 20) {
    freeCount = 5;
  } else {
    freeCount = 8;
  }

  const requestedPaywall = input.paywallPosition == null
    ? null
    : asPositiveInt(input.paywallPosition, 0);
  let paywall: number | null = social || episodeCount <= 3
    ? null
    : requestedPaywall && requestedPaywall > 0
      ? Math.min(episodeCount, requestedPaywall)
      : Math.min(episodeCount, freeCount);

  if (paywall !== null) {
    freeCount = Math.min(freeCount, paywall);
  }

  const payoffAfter = paywall == null
    ? null
    : Math.min(episodeCount, paywall + Math.min(2, Math.max(1, episodeCount - paywall)));

  const climaxStart = ceilingStart(episodeCount);

  const durationMin = Math.min(firstDuration, otherDuration);
  const durationMax = Math.max(firstDuration, otherDuration);

  return {
    distribution_profile: distribution,
    episode_count: episodeCount,
    first_episode_duration_seconds: firstDuration,
    other_episode_duration_seconds: otherDuration,
    episode_duration_min_seconds: durationMin,
    episode_duration_max_seconds: durationMax,
    free_episode_count: paywall == null ? episodeCount : freeCount,
    paywall_episode: paywall,
    payoff_after_paywall_episode: payoffAfter,
    primary_conversion: social ? 'next_view' : 'unlock',
    acquisition_clip_seconds: '5-12s',
    central_question_payoff_window: `${climaxStart}-${episodeCount}`,
    beat_engine_first: beatEngineForDuration(firstDuration),
    beat_engine_other: beatEngineForDuration(otherDuration),
  };
};

export const buildRetentionProfileFromProject = (
  project: Record<string, any>,
): RetentionProfile => {
  const bible = asMap(project.seriesBible);
  const config = asMap(bible.config);
  return buildRetentionProfile({
    episodeCount: asPositiveInt(project.targetEpisodeCount, 8),
    firstDuration: asPositiveInt(
      bible.episode_duration_min_seconds ??
        bible.first_episode_duration_seconds ??
        config.first_episode_duration_seconds,
      EPISODE_DURATION_MIN_SECONDS,
    ),
    otherDuration: asPositiveInt(
      bible.episode_duration_max_seconds ??
        bible.episode_duration_seconds ??
        config.episode_duration_seconds,
      EPISODE_DURATION_MAX_SECONDS,
    ),
    distributionProfile: String(
      bible.distribution_profile || config.distribution_profile || 'app_native',
    ),
    freeEpisodeCount: bible.free_episode_count ?? config.free_episode_count ?? null,
    paywallPosition: bible.paywall_position
      ?? bible.paywall_episode
      ?? config.paywall_position
      ?? null,
  });
};

const block = (
  id: string,
  start: number,
  end: number,
  role: string,
  conversionRole: string,
  mustNot: string[],
): SeasonBlockPlan => ({
  id,
  start,
  end,
  episodes: start === end ? `${start}` : `${start}-${end}`,
  role,
  conversion_role: conversionRole,
  must_not_resolve: mustNot,
});

const lastEnd = (blocks: SeasonBlockPlan[]): number =>
  blocks.length ? blocks[blocks.length - 1].end : 0;

export const ceilingStart = (episodeCount: number): number => {
  const n = Math.max(1, Math.trunc(episodeCount || 1));
  if (n <= 8) return Math.max(1, n - 1);
  if (n <= 20) return Math.max(1, n - 3);
  return Math.max(1, Math.round(n * 0.82));
};

export const plannedSeasonBlocks = (
  episodeCount: number,
  paywallEpisode: number | null,
): SeasonBlockPlan[] => {
  const n = Math.max(1, Math.trunc(episodeCount || 1));
  if (n === 1) {
    return [block(
      'standalone',
      1,
      1,
      'complete_microstory_open_loop',
      'acquisition_clip',
      ['season_mythology'],
    )];
  }

  const paywall = paywallEpisode && paywallEpisode > 0 && paywallEpisode <= n
    ? Math.trunc(paywallEpisode)
    : null;
  const blocks: SeasonBlockPlan[] = [];
  const ceilingFloor = Math.max(n <= 8 ? 2 : 3, ceilingStart(n));
  const remainingAfterPaywall = paywall ? n - paywall : n;

  if (paywall && paywall > 1) {
    blocks.push(block(
      'premise_hook',
      1,
      paywall - 1,
      'detonate_premise_prove_fantasy',
      'free_funnel',
      ['central_question', 'antagonist_defeat'],
    ));
    blocks.push(block(
      'conversion',
      paywall,
      paywall,
      'paywall_question',
      'paywall_cliffhanger',
      ['central_question', 'paywall_answer', 'antagonist_defeat'],
    ));
  } else {
    const funnelEnd = Math.min(n, Math.max(1, paywall || Math.round(n * 0.15) || 1));
    blocks.push(block(
      'premise_hook',
      1,
      funnelEnd,
      'detonate_premise_prove_fantasy',
      paywall === 1 ? 'paywall_cliffhanger' : 'acquisition_clip',
      ['central_question', 'antagonist_defeat'],
    ));
  }

  let cursor = lastEnd(blocks) + 1;
  if (cursor > n) return blocks;

  const shortPaidTail = Boolean(paywall) && remainingAfterPaywall <= 3;
  if (paywall && !shortPaidTail && cursor <= n) {
    const paidEnd = Math.min(n, paywall + 2, ceilingFloor - 1);
    if (paidEnd >= cursor) {
      blocks.push(block(
        'paid_payoff',
        cursor,
        paidEnd,
        'pay_then_open_larger_problem',
        'post_paywall_payoff',
        ['central_question', 'antagonist_defeat'],
      ));
      cursor = paidEnd + 1;
    }
  }
  if (cursor > n) return blocks;

  const climaxStart = Math.max(cursor, ceilingFloor);
  if (n >= 40 && cursor < climaxStart) {
    const darkStart = Math.max(cursor, Math.round(n * 0.45) + 1);
    if (darkStart - 1 >= cursor) {
      blocks.push(block(
        'escalation',
        cursor,
        darkStart - 1,
        'complication_almost_moments',
        'binge_midgame',
        ['central_question', 'antagonist_defeat'],
      ));
      cursor = darkStart;
    }
    if (cursor <= climaxStart - 1) {
      blocks.push(block(
        'dark_middle',
        cursor,
        climaxStart - 1,
        'farthest_from_resolution',
        'sunk_cost',
        ['central_question'],
      ));
      cursor = climaxStart;
    }
  } else if (cursor <= climaxStart - 1) {
    blocks.push(block(
      'escalation',
      cursor,
      climaxStart - 1,
      shortPaidTail ? 'pay_then_open_larger_problem' : 'rising_cost_and_counterplay',
      shortPaidTail ? 'post_paywall_payoff' : 'binge_midgame',
      ['central_question', 'antagonist_defeat'],
    ));
    cursor = climaxStart;
  }

  if (cursor <= n) {
    blocks.push(block(
      'ceiling',
      cursor,
      n,
      'earned_payoff_renewal_hook',
      shortPaidTail ? 'post_paywall_payoff' : 'season_payoff',
      [],
    ));
  }

  return normalizeSeasonBlocks(blocks, n);
};

export const normalizeSeasonBlocks = (
  blocks: SeasonBlockPlan[],
  episodeCount: number,
): SeasonBlockPlan[] => {
  const n = Math.max(1, episodeCount);
  const sorted = [...blocks]
    .map((item) => ({
      ...item,
      start: Math.max(1, Math.trunc(Number(item.start) || 1)),
      end: Math.min(n, Math.trunc(Number(item.end) || n)),
    }))
    .filter((item) => item.start <= item.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: SeasonBlockPlan[] = [];
  let next = 1;
  for (const item of sorted) {
    if (item.end < next) continue;
    const start = Math.max(item.start, next);
    if (start > next && out.length) {
      out[out.length - 1].end = start - 1;
      out[out.length - 1].episodes = out[out.length - 1].start === start - 1
        ? `${out[out.length - 1].start}`
        : `${out[out.length - 1].start}-${start - 1}`;
    } else if (start > next) {
      out.push(block(
        'escalation',
        next,
        start - 1,
        'rising_cost_and_counterplay',
        'binge_midgame',
        ['central_question', 'antagonist_defeat'],
      ));
    }
    out.push({
      ...item,
      start,
      episodes: start === item.end ? `${start}` : `${start}-${item.end}`,
    });
    next = item.end + 1;
  }
  if (next <= n) {
    if (out.length) {
      out[out.length - 1].end = n;
      out[out.length - 1].episodes = out[out.length - 1].start === n
        ? `${n}`
        : `${out[out.length - 1].start}-${n}`;
    } else {
      out.push(block('ceiling', 1, n, 'earned_payoff_renewal_hook', 'season_payoff', []));
    }
  }
  return out;
};

export const blockForEpisode = (
  blocks: SeasonBlockPlan[],
  episodeNumber: number,
): SeasonBlockPlan | null =>
  blocks.find((item) => episodeNumber >= item.start && episodeNumber <= item.end) || null;

export const spineChunkRanges = (
  episodeCount: number,
  chunkSize = SPINE_CHUNK_SIZE,
): Array<{ start: number; end: number }> => {
  const n = Math.max(1, Math.trunc(episodeCount || 1));
  const size = Math.max(1, chunkSize);
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 1; start <= n; start += size) {
    ranges.push({ start, end: Math.min(n, start + size - 1) });
  }
  return ranges;
};

export const outlineBatchRange = (
  fromEpisode: number,
  targetEpisodeCount: number,
  batchSize = DEFAULT_OUTLINE_BATCH_SIZE,
): OutlineBatchRange => {
  const target = Math.max(1, Math.trunc(targetEpisodeCount || 1));
  const size = Math.max(1, Math.min(20, Math.trunc(batchSize || DEFAULT_OUTLINE_BATCH_SIZE)));
  const from = Math.min(target, Math.max(1, Math.trunc(fromEpisode || 1)));
  const through = Math.min(target, from + size - 1);
  const remaining = Math.max(0, target - through);
  return {
    fromEpisode: from,
    throughEpisode: through,
    targetEpisodeCount: target,
    remaining,
    canContinue: remaining > 0,
    nextFromEpisode: remaining > 0 ? through + 1 : null,
    batchSize: size,
    isFullSeason: from === 1 && through === target,
  };
};

export const spineThroughForBatch = (batch: OutlineBatchRange): number =>
  Math.min(batch.targetEpisodeCount, batch.throughEpisode + 1);

export const spineChunkRangesIn = (
  from: number,
  through: number,
  chunkSize = SPINE_CHUNK_SIZE,
): Array<{ start: number; end: number }> => {
  const start = Math.max(1, Math.trunc(from || 1));
  const end = Math.max(start, Math.trunc(through || start));
  return spineChunkRanges(end - start + 1, chunkSize).map((range) => ({
    start: range.start + start - 1,
    end: range.end + start - 1,
  }));
};

export const hasLockedSeasonArchitecture = (bible: unknown): boolean => {
  const blocks = asMap(asMap(bible).season_architecture).blocks;
  return Array.isArray(blocks) && blocks.length > 0;
};

export const lockedRevealsForEpisode = (
  reveals: ReservedReveal[],
  episodeNumber: number,
): ReservedReveal[] =>
  reveals.filter((item) => asPositiveInt(item.earliest_episode, 999) > episodeNumber);

export const compactSpineForPrompt = (
  spine: EpisodeSpineSlot[],
  upToExclusive?: number,
): Array<Record<string, any>> =>
  spine
    .filter((item) => upToExclusive == null || item.episode < upToExclusive)
    .map((item) => ({
      episode: item.episode,
      block_id: item.block_id,
      function: item.function,
      pressure_type: item.pressure_type,
      conversion_role: item.conversion_role,
      must_not: item.must_not,
    }));

export const recentCardsForPrompt = (
  cards: Array<Record<string, any>>,
  episodeNumber: number,
  limit = 2,
): Array<Record<string, any>> =>
  cards
    .map((card) => ({
      episode: asPositiveInt(card.episode, 0),
      title: card.title,
      episode_job: card.episode_job,
      pressure_type: card.pressure_type,
      value_shift: card.value_shift,
      peak_action: card.peak_action,
      next_episode_question: card.next_episode_question,
    }))
    .filter((card) => card.episode > 0 && card.episode < episodeNumber)
    .sort((a, b) => a.episode - b.episode)
    .slice(-limit);

const asSpineSlot = (value: any, fallback: EpisodeSpineSlot): EpisodeSpineSlot => {
  const item = asMap(value);
  return {
    episode: asPositiveInt(item.episode, fallback.episode),
    block_id: String(item.block_id || fallback.block_id),
    function: String(item.function || fallback.function),
    dominant_question: String(item.dominant_question || fallback.dominant_question),
    promise_paid: item.promise_paid == null ? fallback.promise_paid : String(item.promise_paid),
    promise_opened: item.promise_opened == null
      ? fallback.promise_opened
      : String(item.promise_opened),
    reserved_ids_locked: Array.isArray(item.reserved_ids_locked)
      ? item.reserved_ids_locked.map((id: any) => String(id))
      : fallback.reserved_ids_locked,
    pressure_type: String(item.pressure_type || fallback.pressure_type),
    relationship_shift: String(item.relationship_shift || fallback.relationship_shift),
    conversion_role: String(item.conversion_role || fallback.conversion_role),
    must_not: String(item.must_not || fallback.must_not),
  };
};

export const fallbackSpineSlot = (
  episodeNumber: number,
  blockPlan: SeasonBlockPlan | null,
  reveals: ReservedReveal[],
): EpisodeSpineSlot => {
  const plan = blockPlan || block(
    'escalation',
    episodeNumber,
    episodeNumber,
    'rising_cost_and_counterplay',
    'binge_midgame',
    ['central_question'],
  );
  return {
    episode: episodeNumber,
    block_id: plan.id,
    function: plan.role,
    dominant_question: `What irreversible choice does episode ${episodeNumber} force?`,
    promise_paid: plan.conversion_role === 'post_paywall_payoff' ? 'paywall_promise' : null,
    promise_opened: plan.conversion_role === 'paywall_cliffhanger' ? 'paywall_promise' : null,
    reserved_ids_locked: lockedRevealsForEpisode(reveals, episodeNumber).map((item) => item.id),
    pressure_type: plan.role,
    relationship_shift: 'The central bond changes by a visible decision, not a delayed misunderstanding.',
    conversion_role: plan.conversion_role,
    must_not: plan.must_not_resolve.join(', ') || 'Do not restart the premise.',
  };
};

const upsertSpine = (
  byNumber: Map<number, EpisodeSpineSlot>,
  raw: any,
  blocks: SeasonBlockPlan[],
  reveals: ReservedReveal[],
) => {
  const episode = asPositiveInt(asMap(raw).episode, 0);
  if (episode < 1) return;
  const fallback = fallbackSpineSlot(episode, blockForEpisode(blocks, episode), reveals);
  byNumber.set(episode, asSpineSlot(raw, fallback));
};

export const mergeSpine = (
  existing: any[],
  incoming: any[],
  start: number,
  end: number,
  blocks: SeasonBlockPlan[],
  reveals: ReservedReveal[],
): EpisodeSpineSlot[] => {
  const byNumber = new Map<number, EpisodeSpineSlot>();
  for (const raw of existing) upsertSpine(byNumber, raw, blocks, reveals);
  for (const raw of incoming) {
    const episode = asPositiveInt(asMap(raw).episode, 0);
    if (episode < start || episode > end) continue;
    upsertSpine(byNumber, raw, blocks, reveals);
  }
  return [...byNumber.values()].sort((a, b) => a.episode - b.episode);
};

export const ensureFullSpine = (
  spine: EpisodeSpineSlot[],
  episodeCount: number,
  blocks: SeasonBlockPlan[],
  reveals: ReservedReveal[],
): EpisodeSpineSlot[] => {
  const byNumber = new Map(spine.map((item) => [item.episode, item]));
  const out: EpisodeSpineSlot[] = [];
  for (let number = 1; number <= episodeCount; number += 1) {
    out.push(
      byNumber.get(number)
      || fallbackSpineSlot(number, blockForEpisode(blocks, number), reveals),
    );
  }
  return out;
};

export const parseReservedReveals = (value: unknown): ReservedReveal[] => {
  if (!Array.isArray(value)) return [];
  const parsed: ReservedReveal[] = [];
  value.forEach((item, index) => {
    const row = asMap(item);
    const earliest = asPositiveInt(row.earliest_episode, 0);
    const fact = String(row.fact || row.promise || '').trim();
    if (!earliest || !fact) return;
    const reveal: ReservedReveal = {
      id: String(row.id || `r${index + 1}`),
      fact,
      earliest_episode: earliest,
      payoff_episode: asPositiveInt(row.payoff_episode, earliest) || earliest,
    };
    if (row.why_late) reveal.why_late = String(row.why_late);
    parsed.push(reveal);
  });
  return parsed;
};

export const clampReservedReveals = (
  reveals: ReservedReveal[],
  blocks: SeasonBlockPlan[],
): ReservedReveal[] => {
  const ceiling = blocks.find((item) => item.id === 'ceiling');
  const lateStart = blocks.find((item) => item.id === 'dark_middle' || item.id === 'escalation')?.start
    || ceiling?.start
    || 1;
  return reveals.map((item) => {
    if (!ceiling || item.payoff_episode < ceiling.start) return item;
    const earliest = Math.max(item.earliest_episode, lateStart);
    return {
      ...item,
      earliest_episode: earliest,
      payoff_episode: Math.max(item.payoff_episode, earliest, ceiling.start),
    };
  });
};

export const applyPlannedBlockRanges = (
  llmBlocks: any[],
  planned: SeasonBlockPlan[],
): Array<SeasonBlockPlan & Record<string, any>> =>
  planned.map((plan, index) => {
    const fromLlm = (Array.isArray(llmBlocks) ? llmBlocks : []).find(
      (item) => asMap(item).id === plan.id,
    ) || (Array.isArray(llmBlocks) ? llmBlocks[index] : null) || {};
    const row = asMap(fromLlm);
    return {
      ...plan,
      opening_state: row.opening_state || row.openingState || '',
      pressure_engine: row.pressure_engine || '',
      value_change: row.value_change || '',
      relationship_change: row.relationship_change || '',
      irreversible_turn: row.irreversible_turn || '',
      promises_paid: Array.isArray(row.promises_paid) ? row.promises_paid : [],
      questions_opened: Array.isArray(row.questions_opened) ? row.questions_opened : [],
    };
  });

export const seasonContextForEpisode = (
  project: Record<string, any>,
  episodeNumber: number,
): Record<string, any> => {
  const bible = asMap(project.seriesBible);
  const profile = buildRetentionProfileFromProject(project);
  const architecture = asMap(bible.season_architecture);
  const blocks = Array.isArray(architecture.blocks) && architecture.blocks.length
    ? architecture.blocks as SeasonBlockPlan[]
    : plannedSeasonBlocks(profile.episode_count, profile.paywall_episode);
  const reveals = parseReservedReveals(bible.reserved_reveals);
  const spine = ensureFullSpine(
    Array.isArray(bible.episode_spine) ? bible.episode_spine : [],
    profile.episode_count,
    blocks,
    reveals,
  );
  const thisSlot = spine.find((item) => item.episode === episodeNumber)
    || fallbackSpineSlot(episodeNumber, blockForEpisode(blocks, episodeNumber), reveals);
  const duration = episodeDurationSeconds(
    episodeNumber,
    profile.first_episode_duration_seconds,
    profile.other_episode_duration_seconds,
  );
  return {
    retention_profile: {
      distribution_profile: profile.distribution_profile,
      episode_count: profile.episode_count,
      free_episode_count: profile.free_episode_count,
      paywall_episode: profile.paywall_episode,
      payoff_after_paywall_episode: profile.payoff_after_paywall_episode,
      primary_conversion: profile.primary_conversion,
      central_question_payoff_window: profile.central_question_payoff_window,
    },
    beat_engine: beatEngineForDuration(duration),
    season_blocks: blocks.map((item) => ({
      id: item.id,
      episodes: item.episodes,
      role: item.role,
      conversion_role: item.conversion_role,
    })),
    this_slot: thisSlot,
    previous_slot: spine.find((item) => item.episode === episodeNumber - 1) || null,
    next_slot: spine.find((item) => item.episode === episodeNumber + 1) || null,
    locked_reveals: lockedRevealsForEpisode(reveals, episodeNumber),
    viewer_dramatic_irony: bible.viewer_dramatic_irony || '',
    episode_engine: bible.episode_engine || '',
    relationship_engine: bible.relationship_engine || '',
    antagonist_counterplay: bible.antagonist_counterplay || '',
    escalation_ceiling: bible.escalation_ceiling || '',
  };
};
