// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { needsYouEntries } from './needsYouEntries';

const session = (id: string, goal: string) => aSession({ id: id as SessionId, goal });

describe('needsYouEntries', () => {
  it('makes one row per session that needs you, with the reason after the title', () => {
    const entries = needsYouEntries({
      items: [
        {
          session: session('session-retry', 'Retry policy for 429s'),
          reason: 'The agent asked you something',
          attention: 'open-question',
        },
        {
          session: session('session-backoff', 'Notify relay backoff'),
          reason: 'Checks failed on #318',
          attention: 'ci-failed',
        },
      ],
      open: vi.fn(),
    });

    expect(entries.map((entry) => [entry.key, entry.label, entry.detail])).toEqual([
      ['needs:session-retry', 'Retry policy for 429s', 'The agent asked you something'],
      ['needs:session-backoff', 'Notify relay backoff', 'Checks failed on #318'],
    ]);
    expect(entries.every((entry) => entry.kind === 'needs')).toBe(true);
  });

  it('opens the session where the Now chip would, by its attention reason', () => {
    const open = vi.fn();
    const [entry] = needsYouEntries({
      items: [
        {
          session: session('session-retry', 'Retry policy for 429s'),
          reason: 'The agent asked you something',
          attention: 'open-question',
        },
      ],
      open,
    });

    entry?.run();

    expect(open).toHaveBeenCalledWith({
      sessionId: 'session-retry' as SessionId,
      attention: 'open-question',
    });
  });
});
