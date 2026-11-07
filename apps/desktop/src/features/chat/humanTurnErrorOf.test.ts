import { describe, expect, it } from 'vitest';
import { humanTurnErrorOf } from './humanTurnErrorOf';

describe('humanTurnErrorOf', () => {
  it('reads a provider limit in plain words', () => {
    expect(humanTurnErrorOf({ message: 'rate_limit_error: 429 too many requests' })).toBe(
      'The provider is limiting requests right now. Wait a moment, then retry.',
    );
  });

  it('keeps a message that has no known shape', () => {
    expect(humanTurnErrorOf({ message: 'the relay dropped the stream' })).toBe(
      'the relay dropped the stream',
    );
  });

  it('names the provider of the agent', () => {
    expect(
      humanTurnErrorOf({
        message: 'Error: 429 Too Many Requests',
        agent: { providerSessionProviderId: 'anthropic' },
      }),
    ).toBe('Claude is limiting requests right now. Wait a moment, then retry.');
  });

  it('names the CLI of the agent in a version error', () => {
    expect(
      humanTurnErrorOf({
        message: 'Error: 1.0.0 does not support this model; version 1.2.0 or newer is required',
        agent: { providerOverride: 'codex' },
      }),
    ).toBe('This model needs Codex CLI 1.2.0 or newer. You have 1.0.0.');
  });

  it('falls back to the generic name when the agent has no provider yet', () => {
    expect(humanTurnErrorOf({ message: 'Error: 429 Too Many Requests', agent: {} })).toBe(
      'The provider is limiting requests right now. Wait a moment, then retry.',
    );
  });
});
