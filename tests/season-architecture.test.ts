import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyPlannedBlockRanges,
  beatEngineForDuration,
  blockForEpisode,
  blocksOverlappingRange,
  buildRetentionProfile,
  compactBlockMap,
  compactReservedRevealsForSpine,
  compactRetentionForMap,
  compactSpineForPrompt,
  ensureFullSpine,
  lockedRevealsForEpisode,
  mergeSpine,
  outlineBatchRange,
  plannedSeasonBlocks,
  recentCardsForPrompt,
  spineChunkRanges,
  spineChunkRangesIn,
  spineThroughForBatch,
  STORY_KERNEL,
  clampEpisodeDuration,
} from '../src/services/season-architecture.service';

const coveredEpisodes = (episodeCount: number, paywall: number | null) => {
  const blocks = plannedSeasonBlocks(episodeCount, paywall);
  const hits = Array.from({ length: episodeCount + 1 }, () => 0);
  for (const block of blocks) {
    assert.ok(block.start <= block.end, `${block.id} inverted`);
    for (let episode = block.start; episode <= block.end; episode += 1) {
      hits[episode] += 1;
    }
  }
  for (let episode = 1; episode <= episodeCount; episode += 1) {
    assert.equal(hits[episode], 1, `episode ${episode} covered ${hits[episode]} times`);
  }
  return blocks;
};

test('8-episode app series reserves the paywall question and does not spend the finale early', () => {
  const profile = buildRetentionProfile({ episodeCount: 8 });
  assert.equal(profile.paywall_episode, 3);
  assert.equal(profile.payoff_after_paywall_episode, 5);
  assert.equal(profile.central_question_payoff_window, '7-8');
  assert.equal(profile.primary_conversion, 'unlock');

  const blocks = coveredEpisodes(8, profile.paywall_episode);
  assert.equal(blockForEpisode(blocks, 1)?.id, 'premise_hook');
  assert.equal(blockForEpisode(blocks, 3)?.conversion_role, 'paywall_cliffhanger');
  assert.equal(blockForEpisode(blocks, 4)?.id, 'paid_payoff');
  assert.equal(blockForEpisode(blocks, 8)?.id, 'ceiling');
  assert.ok(blockForEpisode(blocks, 3)?.must_not_resolve.includes('paywall_answer'));
  assert.ok(blockForEpisode(blocks, 4)?.must_not_resolve.includes('central_question'));
});

test('60-episode series plans the commercial spine before mid-season dark turn', () => {
  const profile = buildRetentionProfile({ episodeCount: 60 });
  assert.equal(profile.paywall_episode, 8);
  assert.equal(profile.free_episode_count, 8);
  assert.equal(profile.payoff_after_paywall_episode, 10);
  assert.equal(profile.central_question_payoff_window, '49-60');

  const blocks = coveredEpisodes(60, profile.paywall_episode);
  assert.equal(blockForEpisode(blocks, 1)?.role, 'detonate_premise_prove_fantasy');
  assert.equal(blockForEpisode(blocks, 8)?.conversion_role, 'paywall_cliffhanger');
  assert.equal(blockForEpisode(blocks, 9)?.id, 'paid_payoff');
  assert.equal(blockForEpisode(blocks, 20)?.id, 'escalation');
  assert.equal(blockForEpisode(blocks, 40)?.id, 'dark_middle');
  assert.equal(blockForEpisode(blocks, 55)?.id, 'ceiling');
});

test('tiny pilots and social series do not invent a paywall', () => {
  assert.equal(buildRetentionProfile({ episodeCount: 1 }).paywall_episode, null);
  assert.equal(buildRetentionProfile({
    episodeCount: 60,
    distributionProfile: 'social_serialized',
  }).primary_conversion, 'next_view');
  coveredEpisodes(1, null);
  coveredEpisodes(4, 2);
  coveredEpisodes(20, 5);
  coveredEpisodes(80, 8);
});

test('beat engine cuts the button in the last seconds for TikTok-speed retention', () => {
  const sixty = beatEngineForDuration(60);
  assert.equal(sixty.hook, '0-12s');
  assert.equal(sixty.button, '54-60s');
  assert.equal(sixty.freeze_frame_check, '3s');
  const first = beatEngineForDuration(120);
  assert.equal(first.hook, '0-15s');
  assert.equal(first.button, '110-120s');
});

test('episode duration is chosen inside 90-120s, not a fixed EP1/rest split', () => {
  assert.equal(clampEpisodeDuration(60), 90);
  assert.equal(clampEpisodeDuration(180), 120);
  assert.equal(clampEpisodeDuration(105), 105);
  assert.equal(clampEpisodeDuration('97'), 97);
  assert.equal(clampEpisodeDuration(null), 105);
  const profile = buildRetentionProfile({ episodeCount: 8 });
  assert.equal(profile.episode_duration_min_seconds, 90);
  assert.equal(profile.episode_duration_max_seconds, 120);
});

test('story kernel is compact and bans arrival openings once', () => {
  assert.match(STORY_KERNEL, /3s freeze-frame/);
  assert.match(STORY_KERNEL, /adjacent pressure_type/);
  assert.match(STORY_KERNEL, /viewer_dramatic_irony/);
  assert.ok(STORY_KERNEL.length < 900, 'kernel must stay short for DeepSeek');
});

test('outline batches keep the full season map while generating cards in fives', () => {
  const first = outlineBatchRange(1, 50, 5);
  assert.deepEqual(first, {
    fromEpisode: 1,
    throughEpisode: 5,
    targetEpisodeCount: 50,
    remaining: 45,
    canContinue: true,
    nextFromEpisode: 6,
    batchSize: 5,
    isFullSeason: false,
  });
  assert.equal(spineThroughForBatch(first), 6);
  assert.deepEqual(spineChunkRangesIn(1, 6), [{ start: 1, end: 6 }]);

  const mid = outlineBatchRange(6, 50, 5);
  assert.equal(mid.throughEpisode, 10);
  assert.equal(mid.nextFromEpisode, 11);
  assert.deepEqual(spineChunkRangesIn(6, 11), [{ start: 6, end: 11 }]);

  const last = outlineBatchRange(46, 50, 5);
  assert.equal(last.throughEpisode, 50);
  assert.equal(last.canContinue, false);
  assert.equal(last.nextFromEpisode, null);
  assert.equal(spineThroughForBatch(last), 50);

  const short = outlineBatchRange(1, 3, 5);
  assert.equal(short.throughEpisode, 3);
  assert.equal(short.canContinue, false);
  assert.equal(short.isFullSeason, true);
});

test('spine chunks and locked reveals keep EP5 from spending an EP42 secret', () => {
  assert.deepEqual(spineChunkRanges(60), [
    { start: 1, end: 12 },
    { start: 13, end: 24 },
    { start: 25, end: 36 },
    { start: 37, end: 48 },
    { start: 49, end: 60 },
  ]);
  const locked = lockedRevealsForEpisode([
    { id: 'father', fact: 'who the father is', earliest_episode: 42, payoff_episode: 48 },
    { id: 'job', fact: 'the contract is fake', earliest_episode: 4, payoff_episode: 6 },
  ], 5);
  assert.deepEqual(locked.map((item) => item.id), ['father']);
  const hidden = compactReservedRevealsForSpine([
    { id: 'r1', fact: 'O documento é falso', earliest_episode: 42, payoff_episode: 48 },
    { id: 'r2', fact: 'pago agora', earliest_episode: 3, payoff_episode: 5 },
  ], 6);
  assert.deepEqual(hidden[0], { id: 'r1', earliest_episode: 42, locked: true });
  assert.equal(hidden[1].fact, 'pago agora');
  const profile = buildRetentionProfile({ episodeCount: 50 });
  const retention = compactRetentionForMap(profile);
  assert.equal(retention.episode_count, 50);
  assert.equal((retention as { beat_engine_first?: unknown }).beat_engine_first, undefined);
  const seasonBlocks = applyPlannedBlockRanges(
    [{ id: 'premise_hook', opening_state: 'spoiler do final' }],
    plannedSeasonBlocks(50, 8),
  );
  assert.equal(blocksOverlappingRange(seasonBlocks, 1, 6)[0].id, 'premise_hook');
  assert.equal('opening_state' in compactBlockMap(seasonBlocks)[5], false);

  const blocks = plannedSeasonBlocks(8, 3);
  const merged = mergeSpine(
    [{ episode: 1, function: 'detonate', pressure_type: 'identity' }],
    [{ episode: 2, function: 'pay the hook', pressure_type: 'deadline' }, { episode: 20, function: 'ignore' }],
    2,
    2,
    blocks,
    [],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[1].function, 'pay the hook');
  const full = ensureFullSpine(merged, 8, blocks, []);
  assert.equal(full.length, 8);
  assert.equal(full[7].block_id, 'ceiling');
});

test('prompt compaction sends the season map, not a dump of every previous card', () => {
  const compact = compactSpineForPrompt([
    {
      episode: 1,
      block_id: 'premise_hook',
      function: 'detonate',
      dominant_question: 'Will she sign?',
      promise_paid: null,
      promise_opened: 'p1',
      reserved_ids_locked: ['father'],
      pressure_type: 'identity',
      relationship_shift: 'trust cracks',
      conversion_role: 'free_funnel',
      must_not: 'central_question',
    },
    {
      episode: 2,
      block_id: 'premise_hook',
      function: 'escalate',
      dominant_question: 'Will he expose her?',
      promise_paid: null,
      promise_opened: null,
      reserved_ids_locked: ['father'],
      pressure_type: 'deadline',
      relationship_shift: 'forced proximity',
      conversion_role: 'free_funnel',
      must_not: 'central_question',
    },
  ], 2);
  assert.equal(compact.length, 1);
  assert.equal(compact[0].episode, 1);
  assert.ok(!('dominant_question' in compact[0]));

  const recent = recentCardsForPrompt([
    { episode: 1, title: 'A', pressure_type: 'identity', value_shift: 'safe -> hunted' },
    { episode: 2, title: 'B', pressure_type: 'deadline', value_shift: 'hidden -> exposed' },
    { episode: 3, title: 'C', pressure_type: 'betrayal', value_shift: 'trust -> debt' },
  ], 3, 2);
  assert.deepEqual(recent.map((item) => item.episode), [1, 2]);
});

test('LLM block prose cannot move code-owned paywall ranges', () => {
  const planned = plannedSeasonBlocks(8, 3);
  const merged = applyPlannedBlockRanges([
    { id: 'premise_hook', start: 1, end: 7, opening_state: 'She still believes the contract is love.' },
    { id: 'conversion', opening_state: 'The signature is a trap.' },
  ], planned);
  assert.equal(merged[0].end, 2);
  assert.equal(merged[0].opening_state, 'She still believes the contract is love.');
  assert.equal(merged[1].start, 3);
  assert.equal(merged[1].conversion_role, 'paywall_cliffhanger');
});
