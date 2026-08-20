import assert from 'node:assert/strict';
import test from 'node:test';

import {
  openRouterErrorMessage,
  sanitizeOpenRouterReasoning,
} from '../src/services/openrouter.service';
import { DEFAULT_OPENROUTER_MODEL } from '../src/config/ai-models.config';

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
