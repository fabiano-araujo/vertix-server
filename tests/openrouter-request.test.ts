import assert from 'node:assert/strict';
import test from 'node:test';

import {
  nextOpenRouterLengthRetry,
  OPENROUTER_MAX_COMPLETION_USD_PER_MILLION,
  openRouterErrorMessage,
  openRouterProviderPreferences,
  sanitizeOpenRouterReasoning,
  STORY_REASONING_HIDDEN,
  storyCompletionBudget,
} from '../src/services/openrouter.service';
import { DEFAULT_OPENROUTER_MODEL } from '../src/config/ai-models.config';

test('routes OpenRouter to the fastest provider at or below $0.30/M output', () => {
  const previousSort = process.env.OPENROUTER_PROVIDER_SORT;
  const previousPrice = process.env.OPENROUTER_MAX_OUTPUT_PRICE;
  delete process.env.OPENROUTER_PROVIDER_SORT;
  delete process.env.OPENROUTER_MAX_OUTPUT_PRICE;
  try {
    assert.equal(OPENROUTER_MAX_COMPLETION_USD_PER_MILLION, 0.30);
    assert.deepEqual(openRouterProviderPreferences(), {
      sort: 'throughput',
      max_price: { completion: 0.30 },
    });
  } finally {
    if (previousSort === undefined) delete process.env.OPENROUTER_PROVIDER_SORT;
    else process.env.OPENROUTER_PROVIDER_SORT = previousSort;
    if (previousPrice === undefined) delete process.env.OPENROUTER_MAX_OUTPUT_PRICE;
    else process.env.OPENROUTER_MAX_OUTPUT_PRICE = previousPrice;
  }
});

test('allows env overrides for OpenRouter sort and output price cap', () => {
  const previousSort = process.env.OPENROUTER_PROVIDER_SORT;
  const previousPrice = process.env.OPENROUTER_MAX_OUTPUT_PRICE;
  process.env.OPENROUTER_PROVIDER_SORT = 'latency';
  process.env.OPENROUTER_MAX_OUTPUT_PRICE = '0.14';
  try {
    assert.deepEqual(openRouterProviderPreferences(), {
      sort: 'latency',
      max_price: { completion: 0.14 },
    });
  } finally {
    if (previousSort === undefined) delete process.env.OPENROUTER_PROVIDER_SORT;
    else process.env.OPENROUTER_PROVIDER_SORT = previousSort;
    if (previousPrice === undefined) delete process.env.OPENROUTER_MAX_OUTPUT_PRICE;
    else process.env.OPENROUTER_MAX_OUTPUT_PRICE = previousPrice;
  }
});

test('story sheets default to DeepSeek V4 Flash, not Codex', () => {
  assert.equal(DEFAULT_OPENROUTER_MODEL, 'deepseek/deepseek-v4-flash-0731');
});

test('drops reasoning.max_tokens when effort is also set', () => {
  const sanitized = sanitizeOpenRouterReasoning({
    effort: 'high',
    exclude: true,
    max_tokens: 768,
  });
  assert.deepEqual(sanitized, { effort: 'high', exclude: true });
  assert.equal('max_tokens' in (sanitized || {}), false);
});

test('keeps a token budget when effort is omitted', () => {
  assert.deepEqual(
    sanitizeOpenRouterReasoning({ max_tokens: 768, exclude: true }),
    { max_tokens: 768, exclude: true },
  );
});

test('story generation thinks under the hood and only returns the answer', () => {
  assert.deepEqual(STORY_REASONING_HIDDEN, { effort: 'high', exclude: true });
  assert.deepEqual(
    sanitizeOpenRouterReasoning(STORY_REASONING_HIDDEN),
    { effort: 'high', exclude: true },
  );
  assert.equal(storyCompletionBudget(3200), 8192);
  assert.equal(storyCompletionBudget(9000), 9000);
});

test('retries empty answers with thinking still on, but capped so JSON fits', () => {
  const lengthRetry = nextOpenRouterLengthRetry(3200, 'length', '', false);
  assert.ok(lengthRetry);
  assert.equal(lengthRetry?.max_tokens, 8192);
  assert.equal(lengthRetry?.reasoning.effort, undefined);
  assert.equal(lengthRetry?.reasoning.max_tokens, 2048);
  assert.equal(lengthRetry?.reasoning.exclude, true);

  const emptyStop = nextOpenRouterLengthRetry(3200, 'stop', '', false);
  assert.ok(emptyStop);
  assert.equal(emptyStop?.reasoning.max_tokens, 2048);
  assert.equal(emptyStop?.reasoning.exclude, true);

  assert.equal(nextOpenRouterLengthRetry(3200, 'length', '', true), null);
  assert.equal(nextOpenRouterLengthRetry(3200, 'length', '{"ok":true}', false), null);
});

test('surfaces the OpenRouter 400 body instead of Axios status text', () => {
  const message = openRouterErrorMessage({
    message: 'Request failed with status code 400',
    response: {
      status: 400,
      data: {
        error: {
          message: 'Only one of "reasoning.effort" and "reasoning.max_tokens" can be specified',
          code: 400,
        },
      },
    },
  });
  assert.match(message, /OpenRouter 400/);
  assert.match(message, /reasoning\.effort/);
});
