import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendStreamText,
  createOpenRouterStreamAccumulation,
  extractFailedOpenRouterProvider,
  ingestOpenRouterSseLine,
  ingestOpenRouterStreamChunk,
  isOpenRouterJsonFormatError,
  nextOpenRouterLengthRetry,
  reasoningTextFromSource,
  OPENROUTER_IGNORED_PROVIDERS,
  OPENROUTER_MAX_COMPLETION_USD_PER_MILLION,
  openRouterErrorMessage,
  openRouterProviderPreferences,
  sanitizeOpenRouterReasoning,
  STORY_REASONING_HIDDEN,
  STORY_REASONING_VISIBLE,
  storyCompletionBudget,
  toOpenRouterProviderSlug,
} from '../src/services/openrouter.service';
import { DEFAULT_OPENROUTER_MODEL } from '../src/config/ai-models.config';

test('routes OpenRouter to the fastest provider at or below $0.30/M output', () => {
  const previousSort = process.env.OPENROUTER_PROVIDER_SORT;
  const previousPrice = process.env.OPENROUTER_MAX_OUTPUT_PRICE;
  const previousOrder = process.env.OPENROUTER_PROVIDER_ORDER;
  const previousIgnore = process.env.OPENROUTER_PROVIDER_IGNORE;
  delete process.env.OPENROUTER_PROVIDER_SORT;
  delete process.env.OPENROUTER_MAX_OUTPUT_PRICE;
  delete process.env.OPENROUTER_PROVIDER_ORDER;
  delete process.env.OPENROUTER_PROVIDER_IGNORE;
  try {
    assert.equal(OPENROUTER_MAX_COMPLETION_USD_PER_MILLION, 0.30);
    assert.deepEqual(openRouterProviderPreferences(), {
      order: ['DeepSeek', 'Novita', 'DeepInfra', 'SiliconFlow'],
      allow_fallbacks: true,
      ignore: ['sail-research'],
      sort: 'throughput',
      max_price: { completion: 0.30 },
    });
    assert.deepEqual(OPENROUTER_IGNORED_PROVIDERS, ['sail-research']);
  } finally {
    if (previousSort === undefined) delete process.env.OPENROUTER_PROVIDER_SORT;
    else process.env.OPENROUTER_PROVIDER_SORT = previousSort;
    if (previousPrice === undefined) delete process.env.OPENROUTER_MAX_OUTPUT_PRICE;
    else process.env.OPENROUTER_MAX_OUTPUT_PRICE = previousPrice;
    if (previousOrder === undefined) delete process.env.OPENROUTER_PROVIDER_ORDER;
    else process.env.OPENROUTER_PROVIDER_ORDER = previousOrder;
    if (previousIgnore === undefined) delete process.env.OPENROUTER_PROVIDER_IGNORE;
    else process.env.OPENROUTER_PROVIDER_IGNORE = previousIgnore;
  }
});

test('allows env overrides for OpenRouter sort and output price cap', () => {
  const previousSort = process.env.OPENROUTER_PROVIDER_SORT;
  const previousPrice = process.env.OPENROUTER_MAX_OUTPUT_PRICE;
  process.env.OPENROUTER_PROVIDER_SORT = 'latency';
  process.env.OPENROUTER_MAX_OUTPUT_PRICE = '0.14';
  try {
    const prefs = openRouterProviderPreferences();
    assert.equal(prefs.sort, 'latency');
    assert.equal(prefs.max_price.completion, 0.14);
    assert.deepEqual(prefs.ignore, ['sail-research']);
    assert.deepEqual(prefs.order, ['DeepSeek', 'Novita', 'DeepInfra', 'SiliconFlow']);
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

test('story generation skips high-effort thinking so JSON returns faster', () => {
  assert.deepEqual(STORY_REASONING_HIDDEN, { effort: 'none' });
  assert.deepEqual(
    sanitizeOpenRouterReasoning(STORY_REASONING_HIDDEN),
    { effort: 'none' },
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

test('visible studio thinking stays low-effort so DeepSeek does not stall', () => {
  assert.deepEqual(STORY_REASONING_VISIBLE, { effort: 'low', exclude: false });
});

test('accumulates streamed reasoning deltas before the JSON answer', () => {
  const state = createOpenRouterStreamAccumulation();
  assert.equal(
    ingestOpenRouterSseLine(
      state,
      'data: {"choices":[{"delta":{"reasoning":"Inventing a title"}}]}',
    ),
    true,
  );
  assert.equal(
    ingestOpenRouterStreamChunk(state, {
      choices: [{ delta: { reasoning_content: ' for a revenge series.' } }],
    }),
    true,
  );
  assert.equal(
    ingestOpenRouterSseLine(
      state,
      'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"X\\"}"}}]}',
    ),
    false,
  );
  ingestOpenRouterSseLine(state, 'data: [DONE]');
  assert.equal(state.reasoning, 'Inventing a title for a revenge series.');
  assert.equal(state.content, '{"title":"X"}');
});

test('does not stutter when the provider repeats reasoning in details or snapshots', () => {
  assert.equal(
    reasoningTextFromSource({
      reasoning: 'Title first.',
      reasoning_details: [{ type: 'reasoning.text', text: 'Title first.' }],
    }),
    'Title first.',
  );
  assert.equal(
    reasoningTextFromSource({
      reasoning: 'Keep this.',
      reasoning_details: [{ type: 'reasoning.encrypted', data: 'gAAAAA' }],
    }),
    'Keep this.',
  );
  assert.equal(appendStreamText('Hello', 'Hello world'), 'Hello world');
  assert.equal(appendStreamText('Hello world', ' world'), 'Hello world');
  const state = createOpenRouterStreamAccumulation();
  ingestOpenRouterStreamChunk(state, {
    choices: [{ delta: { reasoning: 'Hello' } }],
  });
  ingestOpenRouterStreamChunk(state, {
    choices: [{ delta: { reasoning: 'Hello world' } }],
  });
  assert.equal(state.reasoning, 'Hello world');
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

test('maps Sail Research upstream JSON failures to the ignore slug', () => {
  const message =
    'Upstream error from Sail Research: response_format violated: model emitted invalid JSON: EOF while parsing a value at line 1 column 0';
  assert.equal(toOpenRouterProviderSlug('Sail Research'), 'sail-research');
  assert.equal(extractFailedOpenRouterProvider(message), 'sail-research');
  assert.equal(isOpenRouterJsonFormatError(new Error(message)), true);
  assert.deepEqual(
    openRouterProviderPreferences(['Sail Research']).ignore,
    ['sail-research'],
  );
});
