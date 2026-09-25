import { describe, expect, it } from 'vitest';
import { formatErrorForHumans } from './formatErrorForHumans';

describe('formatErrorForHumans', () => {
  it('states the cause with the provider brand and keeps the raw text as detail', () => {
    expect(
      formatErrorForHumans({ message: 'Error: 429 Too Many Requests', providerId: 'anthropic' }),
    ).toEqual({
      body: 'Claude is limiting requests right now. Wait a moment, then retry.',
      detail: 'Error: 429 Too Many Requests',
    });
  });

  it('names the CLI versions for an outdated CLI', () => {
    const message =
      'Error: 2.1.240 does not support this model; version 2.1.251 or newer is required';
    expect(formatErrorForHumans({ message, providerId: 'anthropic' })).toEqual({
      body: 'This model needs Claude CLI 2.1.251 or newer. You have 2.1.240.',
      detail: message,
    });
  });

  it('says the provider when it is not known', () => {
    expect(formatErrorForHumans({ message: 'connect ECONNREFUSED 127.0.0.1:443' }).body).toBe(
      "The provider couldn't be reached. This usually clears in a minute.",
    );
  });

  it('keeps a short plain message as the body', () => {
    expect(formatErrorForHumans({ message: 'session not found: session-1' })).toEqual({
      body: 'session not found: session-1',
      detail: null,
    });
  });

  it('puts raw provider output behind the detail only', () => {
    const message = 'anthropic: io error: No such file or directory (os error 2)';
    expect(formatErrorForHumans({ message })).toEqual({ body: null, detail: message });
  });
});
