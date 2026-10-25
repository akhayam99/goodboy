import { describe, expect, it } from 'vitest';
import { CHAT_PROVIDER_REFUSAL } from './chatProviderRefusal';
import { chatStartError } from './chatStartError';

describe('chatStartError', () => {
  it('writes the refusal sentence for a not_read_only error', () => {
    const error = chatStartError({
      error: { kind: 'not_read_only', message: 'chat cannot run read-only on cursor' },
    });

    expect(error).toEqual(new Error(CHAT_PROVIDER_REFUSAL));
  });

  it('leaves every other error as it came', () => {
    const database = { kind: 'database', message: 'database error: locked' };

    expect(chatStartError({ error: database })).toBe(database);
    expect(chatStartError({ error: 'plain text' })).toBe('plain text');
    expect(chatStartError({ error: null })).toBeNull();
  });
});
