import { prisma } from './prisma';
import { buildRetentionProfile } from './season-architecture.service';
import * as creditsRepository from '../repositories/credits.repository';
import { findActiveSubscriptionByUserId } from '../repositories/subscription.repository';

export const RETENTION_EVENTS = [
  'start',
  'retain_3s',
  'retain_15s',
  'complete',
  'next_start',
  'abandon',
  'paywall_shown',
  'unlock',
] as const;

export type RetentionEvent = typeof RETENTION_EVENTS[number];

export interface SeriesPaywallFields {
  id?: number;
  freeEpisodeCount?: number | null;
  episodeUnlockCost?: number | null;
  totalEpisodes?: number | null;
}

export interface PaywallAccess {
  locked: boolean;
  unlocked: boolean;
  requiresUnlock: boolean;
  freeEpisodeCount: number;
  paywallEpisode: number | null;
  unlockCost: number;
  hasSubscriptionAccess: boolean;
}

const asMap = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const asPositiveInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

export const isRetentionEvent = (value: unknown): value is RetentionEvent =>
  typeof value === 'string' && (RETENTION_EVENTS as readonly string[]).includes(value);

export const resolveFreeEpisodeCount = (
  series: SeriesPaywallFields,
  episodeCount = 0,
): number => {
  const total = Math.max(
    1,
    asPositiveInt(episodeCount, 0),
    asPositiveInt(series.totalEpisodes, 0),
  );
  const stored = Math.trunc(Number(series.freeEpisodeCount) || 0);
  if (stored > 0) {
    return Math.min(stored, total);
  }
  return buildRetentionProfile({ episodeCount: total }).free_episode_count;
};

export const resolveUnlockCost = (series: SeriesPaywallFields): number =>
  Math.max(1, asPositiveInt(series.episodeUnlockCost, 1));

export const resolvePaywallEpisode = (
  freeEpisodeCount: number,
  episodeCount: number,
): number | null => {
  if (freeEpisodeCount >= episodeCount) return null;
  return freeEpisodeCount;
};

export const episodeRequiresUnlock = (
  episodeNumber: number,
  freeEpisodeCount: number,
): boolean => episodeNumber > Math.max(0, freeEpisodeCount);

export const resolvePaywallAccess = (input: {
  episodeNumber: number;
  episodeCount?: number;
  series: SeriesPaywallFields;
  unlocked?: boolean;
  hasSubscription?: boolean;
}): PaywallAccess => {
  const episodeCount = Math.max(
    asPositiveInt(input.episodeCount, 0),
    asPositiveInt(input.series.totalEpisodes, 0),
    asPositiveInt(input.episodeNumber, 1),
  );
  const freeEpisodeCount = resolveFreeEpisodeCount(input.series, episodeCount);
  const requiresUnlock = episodeRequiresUnlock(input.episodeNumber, freeEpisodeCount);
  const hasSubscriptionAccess = Boolean(input.hasSubscription);
  const unlocked = Boolean(input.unlocked) || hasSubscriptionAccess;
  return {
    locked: requiresUnlock && !unlocked,
    unlocked: requiresUnlock ? unlocked : true,
    requiresUnlock,
    freeEpisodeCount,
    paywallEpisode: resolvePaywallEpisode(freeEpisodeCount, episodeCount),
    unlockCost: resolveUnlockCost(input.series),
    hasSubscriptionAccess,
  };
};

export const applyPaywallToEpisode = <T extends Record<string, any>>(
  episode: T,
  access: PaywallAccess,
): T & {
  isLocked: boolean;
  isUnlocked: boolean;
  unlockCost: number;
  freeEpisodeCount: number;
  paywallEpisode: number | null;
  hasSubscriptionAccess: boolean;
  videoUrl: string;
} => ({
  ...episode,
  videoUrl: access.locked ? '' : String(episode.videoUrl || ''),
  isLocked: access.locked,
  isUnlocked: access.unlocked,
  unlockCost: access.unlockCost,
  freeEpisodeCount: access.freeEpisodeCount,
  paywallEpisode: access.paywallEpisode,
  hasSubscriptionAccess: access.hasSubscriptionAccess,
});

export const paywallFieldsFromBible = (
  bible: unknown,
  episodeCount: number,
): { freeEpisodeCount: number; episodeUnlockCost: number } => {
  const root = asMap(bible);
  const architecture = asMap(root.season_architecture);
  const retention = asMap(root.retention_profile);
  const count = Math.max(
    asPositiveInt(episodeCount, 0),
    asPositiveInt(architecture.episode_count, 0),
    asPositiveInt(retention.episode_count, 0),
    1,
  );
  const profile = buildRetentionProfile({
    episodeCount: count,
    freeEpisodeCount: architecture.free_episode_count
      ?? retention.free_episode_count
      ?? root.free_episode_count,
    paywallPosition: architecture.paywall_episode
      ?? retention.paywall_episode
      ?? root.paywall_episode,
    distributionProfile: architecture.distribution_profile
      ?? retention.distribution_profile,
  });
  return {
    freeEpisodeCount: profile.free_episode_count,
    episodeUnlockCost: asPositiveInt(root.episode_unlock_cost, 1),
  };
};

const seriesSelect = {
  id: true,
  freeEpisodeCount: true,
  episodeUnlockCost: true,
  totalEpisodes: true,
} as const;

const viewerHasSubscription = async (userId?: number | null): Promise<boolean> => {
  if (!userId) return false;
  const subscription = await findActiveSubscriptionByUserId(userId);
  return Boolean(subscription);
};

export const decorateEpisodesForViewer = async (
  episodes: any[],
  userId?: number | null,
): Promise<any[]> => {
  if (!episodes.length) return [];

  const seriesIds = [...new Set(episodes.map((episode) => Number(episode.seriesId || episode.series?.id)).filter(Boolean))];
  const episodeIds = episodes.map((episode) => Number(episode.id)).filter(Boolean);

  const [seriesRows, unlocks, hasSubscription] = await Promise.all([
    prisma.series.findMany({
      where: { id: { in: seriesIds } },
      select: seriesSelect,
    }),
    userId
      ? prisma.episodeUnlock.findMany({
          where: { userId, episodeId: { in: episodeIds } },
          select: { episodeId: true },
        })
      : Promise.resolve([] as { episodeId: number }[]),
    viewerHasSubscription(userId),
  ]);

  const seriesById = new Map(seriesRows.map((row) => [row.id, row]));
  const unlockedIds = new Set(unlocks.map((row) => row.episodeId));
  const countBySeries = new Map<number, number>();
  for (const episode of episodes) {
    const seriesId = Number(episode.seriesId || episode.series?.id);
    countBySeries.set(seriesId, (countBySeries.get(seriesId) || 0) + 1);
  }

  return episodes.map((episode) => {
    const seriesId = Number(episode.seriesId || episode.series?.id);
    const series = seriesById.get(seriesId) || episode.series || {};
    const access = resolvePaywallAccess({
      episodeNumber: Number(episode.episodeNumber || 0),
      episodeCount: Math.max(
        Number(series.totalEpisodes || 0),
        countBySeries.get(seriesId) || 0,
      ),
      series,
      unlocked: unlockedIds.has(Number(episode.id)),
      hasSubscription,
    });
    const decorated = applyPaywallToEpisode(episode, access);
    if (decorated.series && typeof decorated.series === 'object') {
      decorated.series = {
        ...decorated.series,
        freeEpisodeCount: access.freeEpisodeCount,
        episodeUnlockCost: access.unlockCost,
        paywallEpisode: access.paywallEpisode,
      };
    }
    return decorated;
  });
};

export const decorateEpisodeForViewer = async (
  episode: any,
  userId?: number | null,
) => {
  const [decorated] = await decorateEpisodesForViewer(episode ? [episode] : [], userId);
  return decorated || episode;
};

export const syncSeriesPaywallFromBible = async (
  seriesId: number,
  bible: unknown,
  episodeCount?: number,
) => {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true, totalEpisodes: true },
  });
  if (!series) return null;
  const fields = paywallFieldsFromBible(
    bible,
    Math.max(asPositiveInt(episodeCount, 0), series.totalEpisodes || 1),
  );
  return prisma.series.update({
    where: { id: seriesId },
    data: fields,
  });
};

export const recordRetentionEvent = async (input: {
  userId: number;
  episodeId: number;
  seriesId: number;
  event: RetentionEvent;
  positionSeconds?: number;
}) => prisma.watchRetentionEvent.create({
  data: {
    userId: input.userId,
    episodeId: input.episodeId,
    seriesId: input.seriesId,
    event: input.event,
    positionSeconds: Math.max(0, Math.trunc(input.positionSeconds || 0)),
  },
});

export const unlockEpisodeForUser = async (input: {
  userId: number;
  episode: {
    id: number;
    seriesId: number;
    episodeNumber: number;
    videoUrl: string;
    series?: SeriesPaywallFields | null;
  };
}) => {
  const series = input.episode.series || await prisma.series.findUnique({
    where: { id: input.episode.seriesId },
    select: seriesSelect,
  });
  if (!series) {
    return { ok: false as const, status: 404, message: 'Serie nao encontrada' };
  }

  const hasSubscription = await viewerHasSubscription(input.userId);
  const existing = await prisma.episodeUnlock.findUnique({
    where: {
      userId_episodeId: {
        userId: input.userId,
        episodeId: input.episode.id,
      },
    },
  });

  const access = resolvePaywallAccess({
    episodeNumber: input.episode.episodeNumber,
    series,
    unlocked: Boolean(existing),
    hasSubscription,
  });

  if (!access.requiresUnlock || access.unlocked) {
    return {
      ok: true as const,
      alreadyUnlocked: true,
      creditsSpent: 0,
      availableCredits: (await creditsRepository.getUserCredits(input.userId)).availableCredits,
      access: { ...access, locked: false, unlocked: true },
    };
  }

  const cost = access.unlockCost;
  const credits = await creditsRepository.getUserCredits(input.userId);
  if (credits.isLocked()) {
    return {
      ok: false as const,
      status: 402,
      reason: 'locked',
      message: 'Moedas bloqueadas ate o proximo ciclo diario',
      availableCredits: credits.availableCredits,
      unlockCost: cost,
    };
  }
  if (credits.availableCredits < cost) {
    return {
      ok: false as const,
      status: 402,
      reason: 'no_credits',
      message: 'Moedas insuficientes para desbloquear este episodio',
      availableCredits: credits.availableCredits,
      unlockCost: cost,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.episodeUnlock.findUnique({
        where: {
          userId_episodeId: {
            userId: input.userId,
            episodeId: input.episode.id,
          },
        },
      });
      if (duplicate) return;

      const updated = await tx.userCredits.updateMany({
        where: {
          userId: input.userId,
          availableCredits: { gte: cost },
        },
        data: {
          availableCredits: { decrement: cost },
        },
      });
      if (updated.count === 0) {
        throw new Error('NO_CREDITS');
      }

      await tx.episodeUnlock.create({
        data: {
          userId: input.userId,
          episodeId: input.episode.id,
          seriesId: input.episode.seriesId,
          creditsSpent: cost,
        },
      });
    });
  } catch (error: any) {
    if (error?.message === 'NO_CREDITS') {
      const latest = await creditsRepository.getUserCredits(input.userId);
      return {
        ok: false as const,
        status: 402,
        reason: 'no_credits',
        message: 'Moedas insuficientes para desbloquear este episodio',
        availableCredits: latest.availableCredits,
        unlockCost: cost,
      };
    }
    throw error;
  }

  const remaining = await creditsRepository.getUserCredits(input.userId);
  await recordRetentionEvent({
    userId: input.userId,
    episodeId: input.episode.id,
    seriesId: input.episode.seriesId,
    event: 'unlock',
  }).catch(() => undefined);

  return {
    ok: true as const,
    alreadyUnlocked: false,
    creditsSpent: cost,
    availableCredits: remaining.availableCredits,
    access: {
      ...access,
      locked: false,
      unlocked: true,
    },
  };
};
