import { describe, expect, it } from 'vitest';
import { classifyProviderError } from './classifyProviderError';

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
    'usage limit reached for this account',
  ])('classifies usage failures as a rate limit', (message) => {
    expect(classifyProviderError({ message })).toEqual({ kind: 'rate_limit' });
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
