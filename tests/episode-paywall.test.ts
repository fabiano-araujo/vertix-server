import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyPaywallToEpisode,
  episodeRequiresUnlock,
  isRetentionEvent,
  paywallFieldsFromBible,
  resolveFreeEpisodeCount,
  resolvePaywallAccess,
} from '../src/services/episode-paywall.service';
import { buildRetentionProfile } from '../src/services/season-architecture.service';

test('paywall starts after the free cliffhanger episode, not inside the map copy', () => {
  const profile = buildRetentionProfile({ episodeCount: 8 });
  assert.equal(profile.paywall_episode, 3);
  assert.equal(episodeRequiresUnlock(3, profile.free_episode_count), false);
  assert.equal(episodeRequiresUnlock(4, profile.free_episode_count), true);

  const locked = resolvePaywallAccess({
    episodeNumber: 4,
    episodeCount: 8,
    series: { freeEpisodeCount: profile.free_episode_count, totalEpisodes: 8 },
  });
  assert.equal(locked.locked, true);
  assert.equal(locked.unlockCost, 1);
  assert.equal(locked.paywallEpisode, 3);

  const redacted = applyPaywallToEpisode(
    { id: 40, videoUrl: 'https://cdn.example/ep4.mp4', episodeNumber: 4 },
    locked,
  );
  assert.equal(redacted.videoUrl, '');
  assert.equal(redacted.isLocked, true);
});

test('subscription or prior unlock keeps the video url', () => {
  const series = { freeEpisodeCount: 3, totalEpisodes: 8, episodeUnlockCost: 1 };
  const subscribed = resolvePaywallAccess({
    episodeNumber: 5,
    series,
    hasSubscription: true,
  });
  assert.equal(subscribed.locked, false);
  assert.equal(subscribed.hasSubscriptionAccess, true);

  const unlocked = resolvePaywallAccess({
    episodeNumber: 5,
    series,
    unlocked: true,
  });
  const visible = applyPaywallToEpisode(
    { videoUrl: 'https://cdn.example/ep5.mp4' },
    unlocked,
  );
  assert.equal(visible.videoUrl, 'https://cdn.example/ep5.mp4');
});

test('unset series fields derive the same free count as the season architecture', () => {
  assert.equal(resolveFreeEpisodeCount({ totalEpisodes: 8 }), 3);
  assert.equal(resolveFreeEpisodeCount({ totalEpisodes: 60 }), 8);
  assert.equal(resolveFreeEpisodeCount({ freeEpisodeCount: 5, totalEpisodes: 20 }), 5);
});

test('bible paywall numbers become the commercial free count', () => {
  const fields = paywallFieldsFromBible({
    season_architecture: {
      free_episode_count: 3,
      paywall_episode: 3,
    },
  }, 8);
  assert.equal(fields.freeEpisodeCount, 3);
  assert.equal(fields.episodeUnlockCost, 1);
});

test('retention events match the DramaBox next-tap funnel', () => {
  for (const event of ['start', 'retain_3s', 'retain_15s', 'complete', 'next_start', 'paywall_shown', 'unlock']) {
    assert.equal(isRetentionEvent(event), true);
  }
  assert.equal(isRetentionEvent('clicked_random'), false);
});
