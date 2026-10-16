// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { composerPlaceholder } from './composerPlaceholder';
import { fixtureMessage } from './testing/conversationFixtures';

describe('composerPlaceholder', () => {
  it.each([
    [{ reply: 'thread', startThread: true }, 'Linear', 'Reply on Linear'],
    [{ reply: 'quote', startThread: true }, 'GitHub issues', 'Reply on GitHub'],
    [{ reply: 'none', startThread: false }, 'Slack', 'Reply in thread'],
  ] as const)('names where the reply goes for %o', (shape, toolLabel, expected) => {
    expect(
      composerPlaceholder({
        capabilities: { ...shape, resolve: false, react: false },
        target: null,
        toolLabel,
      }),
    ).toBe(expected);
  });

  it('asks for a reply while a message is targeted', () => {
    const message = fixtureMessage({ id: 'm', name: 'Robin', body: 'x' });

    expect(
      composerPlaceholder({
        capabilities: { reply: 'thread', startThread: true, resolve: false, react: false },
        target: { threadId: 't', message, mode: 'thread' },
        toolLabel: 'Linear',
      }),
    ).toBe('Write a reply');
  });
});
