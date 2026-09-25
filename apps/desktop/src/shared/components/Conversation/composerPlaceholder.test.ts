import { describe, expect, it } from 'vitest';
import { composerPlaceholder } from './composerPlaceholder';
import { fixtureMessage } from './testing/conversationFixtures';

describe('composerPlaceholder', () => {
  it.each([
    [{ reply: 'thread', startThread: true }, 'Start a new thread'],
    [{ reply: 'quote', startThread: true }, 'Write a comment'],
    [{ reply: 'none', startThread: false }, 'Reply in thread'],
  ] as const)('names what the composer does for %o', (shape, expected) => {
    expect(
      composerPlaceholder({
        capabilities: { ...shape, resolve: false, react: false },
        target: null,
      }),
    ).toBe(expected);
  });

  it('asks for a reply while a message is targeted', () => {
    const message = fixtureMessage({ id: 'm', name: 'Robin', body: 'x' });

    expect(
      composerPlaceholder({
        capabilities: { reply: 'thread', startThread: true, resolve: false, react: false },
        target: { threadId: 't', message, mode: 'thread' },
      }),
    ).toBe('Write a reply');
  });
});
