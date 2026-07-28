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
});
