import prisma from './prisma';

// ============================================
// ALGORITHM WEIGHTS
// ============================================

const WEIGHTS = {
  completionRate: 0.35,
  likeWeight: 0.25,
  trendingScore: 0.20,
  userGenreAffinity: 0.20,
};

// Genre categories for affinity calculation
const GENRE_CATEGORIES = [
  'acao', 'aventura', 'comedia', 'drama', 'fantasia',
  'ficcao', 'horror', 'misterio', 'romance', 'suspense',
  'terror', 'thriller', 'animacao', 'documentario', 'musical'
];

// ============================================
// TYPES
// ============================================

interface UserPreferencesData {
  [genre: string]: number;
}

interface EpisodeWithScore {
  episode: any;
  score: number;
}

// ============================================
// PREFERENCE MANAGEMENT
// ============================================

/**
 * Get or create user preferences
 */
export const getUserPreferences = async (userId: number): Promise<UserPreferencesData> => {
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  if (prefs) {
    try {
      return JSON.parse(prefs.preferences);
    } catch {
      return {};
    }
  }

  // Create default preferences
  await prisma.userPreferences.create({
    data: {
      userId,
      preferences: JSON.stringify({}),
    },
  });

  return {};
};

/**
 * Update user preferences based on interaction
 */
export const updateUserPreferences = async (
  userId: number,
  genre: string,
  action: 'view' | 'like' | 'complete' | 'share',
  weight: number = 1
): Promise<void> => {
  const actionWeights = {
    view: 1,
    like: 3,
    complete: 5,
    share: 4,
  };

  const currentPrefs = await getUserPreferences(userId);
  const genreLower = genre.toLowerCase();

  // Calculate new weight
  const currentWeight = currentPrefs[genreLower] || 0;
  const addedWeight = actionWeights[action] * weight;
  const newWeight = Math.min(currentWeight + addedWeight, 100); // Cap at 100

  currentPrefs[genreLower] = newWeight;

  // Normalize weights (decay older preferences slightly)
  const totalWeight = Object.values(currentPrefs).reduce((sum, w) => sum + w, 0);
  if (totalWeight > 200) {
    const factor = 200 / totalWeight;
    for (const key of Object.keys(currentPrefs)) {
      currentPrefs[key] = currentPrefs[key] * factor;
    }
  }

  await prisma.userPreferences.upsert({
    where: { userId },
    update: { preferences: JSON.stringify(currentPrefs) },
    create: {
      userId,
      preferences: JSON.stringify(currentPrefs),
    },
  });

  console.log(`[Recommendation] Updated preferences for user ${userId}: ${genreLower} = ${newWeight}`);
};

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Calculate recommendation score for an episode
 * score = (completionRate * 0.35) + (likeWeight * 0.25) + (trendingScore * 0.20) + (userGenreAffinity * 0.20)
 */
export const calculateEpisodeScore = (
  episode: any,
  series: any,
  userPreferences: UserPreferencesData
): number => {
  // 1. Completion Rate Score (0-1)
  const completionScore = episode.completionRate * WEIGHTS.completionRate;

  // 2. Like Weight Score (normalized)
  const totalInteractions = episode.views + episode.likesCount;
  const likeRatio = totalInteractions > 0 ? episode.likesCount / totalInteractions : 0;
  const likeScore = likeRatio * WEIGHTS.likeWeight;

  // 3. Trending Score (from series, normalized 0-1)
  const trendingNormalized = Math.min(series.trendingScore / 100, 1);
  const trendingScoreValue = trendingNormalized * WEIGHTS.trendingScore;

  // 4. User Genre Affinity (normalized 0-1)
  const genreLower = (series.genre || '').toLowerCase();
  const genreWeight = userPreferences[genreLower] || 0;
  const normalizedGenreWeight = Math.min(genreWeight / 100, 1);
  const affinityScore = normalizedGenreWeight * WEIGHTS.userGenreAffinity;

  const totalScore = completionScore + likeScore + trendingScoreValue + affinityScore;

  return totalScore;
};

/**
 * Calculate series score (aggregate of episodes)
 */
export const calculateSeriesScore = (
  series: any,
  userPreferences: UserPreferencesData
): number => {
  // Base trending score
  const trendingNormalized = Math.min(series.trendingScore / 100, 1);
  const trendingScore = trendingNormalized * 0.3;

  // Hype score
  const hypeNormalized = Math.min(series.hypeScore / 100, 1);
  const hypeScore = hypeNormalized * 0.2;

  // Genre affinity
  const genreLower = (series.genre || '').toLowerCase();
  const genreWeight = userPreferences[genreLower] || 0;
  const affinityScore = (genreWeight / 100) * 0.3;

  // Recency bonus (newer content gets slight boost)
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(series.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyScore = daysSinceCreated < 7 ? 0.2 : daysSinceCreated < 30 ? 0.1 : 0;

  return trendingScore + hypeScore + affinityScore + recencyScore;
};

// ============================================
// FEED GENERATION
// ============================================

/**
 * Get personalized "For You" feed
 */
export const getPersonalizedFeed = async (
  userId: number,
  limit: number = 20,
  offset: number = 0
): Promise<any[]> => {
  // Get user preferences
  const userPreferences = await getUserPreferences(userId);

  // Get user's watch history to exclude already watched
  const watchHistory = await prisma.watchHistory.findMany({
    where: {
      userId,
      progress: { gte: 0.9 }, // 90% or more watched
    },
    select: { episodeId: true },
  });
  const watchedEpisodeIds = watchHistory.map(w => w.episodeId);

  // Get episodes with series data
  const episodes = await prisma.episode.findMany({
    where: {
      id: { notIn: watchedEpisodeIds.length > 0 ? watchedEpisodeIds : undefined },
      series: { status: 'PUBLISHED' },
    },
    include: {
      series: true,
    },
    take: limit * 3, // Get more to score and filter
  });

  // Calculate scores
  const scoredEpisodes: EpisodeWithScore[] = episodes.map(episode => ({
    episode,
    score: calculateEpisodeScore(episode, episode.series, userPreferences),
  }));

  // Sort by score
  scoredEpisodes.sort((a, b) => b.score - a.score);

  // Add randomization for diversity (shuffle top results slightly)
  const topEpisodes = scoredEpisodes.slice(0, Math.min(limit * 2, scoredEpisodes.length));
  for (let i = topEpisodes.length - 1; i > 0; i--) {
    // Only shuffle within nearby positions to maintain rough ordering
    const maxSwap = Math.min(3, i);
    const j = i - Math.floor(Math.random() * maxSwap);
    [topEpisodes[i], topEpisodes[j]] = [topEpisodes[j], topEpisodes[i]];
  }

  // Return paginated results
  return topEpisodes
    .slice(offset, offset + limit)
    .map(({ episode, score }) => ({
      ...episode,
      _score: score,
    }));
};

/**
 * Get trending episodes (global, not personalized)
 */
export const getTrendingFeed = async (
  limit: number = 20,
  offset: number = 0
): Promise<any[]> => {
  return prisma.episode.findMany({
    where: {
      series: { status: 'PUBLISHED' },
    },
    include: {
      series: {
        select: {
          id: true,
          title: true,
          genre: true,
          coverUrl: true,
          trendingScore: true,
        },
      },
    },
    orderBy: [
      { series: { trendingScore: 'desc' } },
      { views: 'desc' },
      { likesCount: 'desc' },
    ],
    skip: offset,
    take: limit,
  });
};

/**
 * Get new releases
 */
export const getNewReleases = async (
  limit: number = 20,
  offset: number = 0
): Promise<any[]> => {
  return prisma.episode.findMany({
    where: {
      series: { status: 'PUBLISHED' },
    },
    include: {
      series: {
        select: {
          id: true,
          title: true,
          genre: true,
          coverUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });
};

/**
 * Get episodes by genre
 */
export const getByGenre = async (
  genre: string,
  limit: number = 20,
  offset: number = 0
): Promise<any[]> => {
  return prisma.episode.findMany({
    where: {
      series: {
        status: 'PUBLISHED',
        genre: {
          contains: genre,
        },
      },
    },
    include: {
      series: {
        select: {
          id: true,
          title: true,
          genre: true,
          coverUrl: true,
        },
      },
    },
    orderBy: [
      { views: 'desc' },
      { likesCount: 'desc' },
    ],
    skip: offset,
    take: limit,
  });
};

// ============================================
// SERIES RECOMMENDATIONS
// ============================================

/**
 * Get recommended series for user
 */
export const getRecommendedSeries = async (
  userId: number,
  limit: number = 10
): Promise<any[]> => {
  const userPreferences = await getUserPreferences(userId);

  const series = await prisma.series.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      _count: {
        select: { episodes: true },
      },
    },
    take: limit * 2,
  });

  // Score and sort
  const scoredSeries = series.map(s => ({
    series: s,
    score: calculateSeriesScore(s, userPreferences),
  }));

  scoredSeries.sort((a, b) => b.score - a.score);

  return scoredSeries.slice(0, limit).map(({ series }) => series);
};

/**
 * Get series for home carousels
 */
export const getHomeCarousels = async (userId?: number) => {
  const userPreferences = userId ? await getUserPreferences(userId) : {};

  const [trending, newReleases, recommended] = await Promise.all([
    // Em Alta (Trending)
    prisma.series.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { trendingScore: 'desc' },
      take: 10,
      include: {
        _count: { select: { episodes: true } },
      },
    }),

    // Novidades (New)
    prisma.series.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: { select: { episodes: true } },
      },
    }),

    // Recomendado (if user logged in)
    userId
      ? getRecommendedSeries(userId, 10)
      : prisma.series.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: { hypeScore: 'desc' },
          take: 10,
          include: {
            _count: { select: { episodes: true } },
          },
        }),
  ]);

  // Get series by genres
  const genreCarousels: { [genre: string]: any[] } = {};
  for (const genre of ['acao', 'romance', 'terror', 'comedia', 'drama']) {
    genreCarousels[genre] = await prisma.series.findMany({
      where: {
        status: 'PUBLISHED',
        genre: { contains: genre },
      },
      orderBy: { trendingScore: 'desc' },
      take: 10,
      include: {
        _count: { select: { episodes: true } },
      },
    });
  }

  return {
    trending,
    newReleases,
    recommended,
    byGenre: genreCarousels,
  };
};

// ============================================
// TRENDING SCORE UPDATES
// ============================================

/**
 * Update trending scores based on recent activity
 * Should be called periodically (e.g., every hour)
 */
export const updateTrendingScores = async (): Promise<void> => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get series with recent activity
  const seriesWithActivity = await prisma.series.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      episodes: {
        select: {
          id: true,
          views: true,
          likesCount: true,
          commentsCount: true,
          sharesCount: true,
        },
      },
    },
  });

  for (const series of seriesWithActivity) {
    // Calculate trending score based on episode metrics
    const totalViews = series.episodes.reduce((sum, ep) => sum + ep.views, 0);
    const totalLikes = series.episodes.reduce((sum, ep) => sum + ep.likesCount, 0);
    const totalComments = series.episodes.reduce((sum, ep) => sum + ep.commentsCount, 0);
    const totalShares = series.episodes.reduce((sum, ep) => sum + ep.sharesCount, 0);

    // Weighted score
    const trendingScore =
      (totalViews * 1) +
      (totalLikes * 5) +
      (totalComments * 3) +
      (totalShares * 10);

    // Normalize to 0-100 range (adjust divisor based on your scale)
    const normalizedScore = Math.min(trendingScore / 1000, 100);

    await prisma.series.update({
      where: { id: series.id },
      data: { trendingScore: normalizedScore },
    });
  }

  console.log(`[Recommendation] Updated trending scores for ${seriesWithActivity.length} series`);
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Preferences
  getUserPreferences,
  updateUserPreferences,
  // Scoring
  calculateEpisodeScore,
  calculateSeriesScore,
  // Feeds
  getPersonalizedFeed,
  getTrendingFeed,
  getNewReleases,
  getByGenre,
  // Series
  getRecommendedSeries,
  getHomeCarousels,
  // Maintenance
  updateTrendingScores,
};
