import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyProviderError } from './classifyProviderError';

const BASE_NOW = new Date(2026, 6, 30, 9, 0, 0);

describe('classifyProviderError', () => {
  it.each([
    [
      'ActionRequiredError: Max Mode Required  The model "gpt-5.5-high" requires Max Mode to be enabled.',
      'gpt-5.5-high',
      'enable_max_mode',
    ],
    [
      'ActionRequiredError: Max Mode Required  The model "claude-opus-4-7-thinking-high" requires Max Mode to be enabled.',
      'claude-opus-4-7-thinking-high',
      'enable_max_mode',
    ],
    [
      '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-5.6\' model is not supported when using Codex with a ChatGPT account."}}',
      'gpt-5.6',
      'choose_supported_model',
    ],
  ])('classifies model availability failures', (message, model, action) => {
    expect(classifyProviderError({ message })).toEqual({
      kind: 'model_not_available',
      model,
      action,
    });
  });

  it('distinguishes authentication and other failures', () => {
    expect(classifyProviderError({ message: 'request failed with status 401' })).toEqual({
      kind: 'authentication',
    });
    expect(classifyProviderError({ message: 'connection reset by peer' })).toEqual({
      kind: 'other',
    });
  });

  it.each([
    'Error: rate limit exceeded, retry after 60s',
    'request failed with status 429',
    'You have exceeded your quota for this billing period',
  ])('classifies usage failures as a rate limit', (message) => {
    expect(classifyProviderError({ message })).toEqual({ kind: 'rate_limit' });
  });

  describe('account usage limits', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('classifies an account usage limit with the parsed reset time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(BASE_NOW);

      expect(
        classifyProviderError({
          message:
            "You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing) or try again at 3:10 PM.",
        }),
      ).toEqual({
        kind: 'usage_limit',
        resetAtMs: new Date(2026, 6, 30, 15, 10, 0, 0).getTime(),
      });
    });

    it('rolls an already passed reset time to tomorrow', () => {
      vi.useFakeTimers();
      vi.setSystemTime(BASE_NOW);

      expect(
        classifyProviderError({ message: "You've hit your usage limit. Try again at 8:00 AM." }),
      ).toEqual({
        kind: 'usage_limit',
        resetAtMs: new Date(2026, 6, 31, 8, 0, 0, 0).getTime(),
      });
    });

    it('classifies an account usage limit without a reset time', () => {
      expect(classifyProviderError({ message: 'usage limit reached for this account' })).toEqual({
        kind: 'usage_limit',
      });
    });
  });

  it.each([
    'connect ECONNREFUSED 127.0.0.1:443',
    'getaddrinfo ENOTFOUND api.anthropic.com',
    'request to https://api.example.com failed: ETIMEDOUT',
    'socket hang up',
    'network error while contacting the provider',
    'upstream returned 503 Service Unavailable',
    'the request timed out after 120s',
  ])('classifies transport failures as unreachable', (message) => {
    expect(classifyProviderError({ message })).toEqual({ kind: 'unreachable' });
  });

  it('keeps a Max Mode failure out of the transport buckets', () => {
    expect(
      classifyProviderError({
        message: 'Max Mode Required  The model "gpt-5.5-high" requires Max Mode to be enabled.',
      }),
    ).toEqual({
      kind: 'model_not_available',
      model: 'gpt-5.5-high',
      action: 'enable_max_mode',
    });
  });
});
