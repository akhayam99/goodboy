// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SessionId, SessionStageInfo } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { needsYouEntries } from './needsYouEntries';

const session = (id: string, goal: string) => aSession({ id: id as SessionId, goal });

const info = (over: Partial<SessionStageInfo>): SessionStageInfo => ({
  stage: 'attention',
  reason: '',
  addsFact: true,
  attention: null,
  prState: null,
  ...over,
});

describe('needsYouEntries', () => {
  it('makes one row per session that needs you, with the words of its reason after the title', () => {
    const entries = needsYouEntries({
      items: [
        {
          session: session('session-retry', 'Retry policy for 429s'),
          info: info({ attention: 'open-question', openQuestionCount: 2 }),
        },
        {
          session: session('session-backoff', 'Notify relay backoff'),
          info: info({ attention: 'ci-failed' }),
        },
      ],
      open: vi.fn(),
    });

    expect(entries.map((entry) => [entry.key, entry.label, entry.detail])).toEqual([
      ['needs:session-retry', 'Retry policy for 429s', '2 questions for you'],
      ['needs:session-backoff', 'Notify relay backoff', 'Checks failing'],
    ]);
    expect(entries.every((entry) => entry.kind === 'needs')).toBe(true);
  });

  it('opens the session where the Now chip would, by its attention reason', () => {
    const open = vi.fn();
    const [entry] = needsYouEntries({
      items: [
        {
          session: session('session-retry', 'Retry policy for 429s'),
          info: info({ attention: 'open-question' }),
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
