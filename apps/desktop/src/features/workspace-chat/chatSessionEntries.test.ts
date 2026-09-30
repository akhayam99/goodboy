import { describe, expect, it } from 'vitest';
import type { ChatSessionLink, Session, SessionStage } from '@goodboy/types';
import { chatSessionEntries, mostUrgentStage } from './chatSessionEntries';

const AT = '2026-09-28T10:00:00.000Z';

const sessionOf = (id: string, extra: Partial<Session> = {}): Session =>
  ({ id, goal: id, createdAt: AT, updatedAt: AT, ...extra }) as Session;

const linkOf = (id: string, sessionId: string): ChatSessionLink =>
  ({
    id,
    chatId: 'chat',
    sessionId,
    messageId: null,
    kind: 'new',
    createdAt: AT,
  }) as ChatSessionLink;

describe('chatSessionEntries', () => {
  it('keeps links in order, tags each with its stage and drops deleted or missing sessions', () => {
    const entries = chatSessionEntries({
      links: [linkOf('a', 's1'), linkOf('b', 's2'), linkOf('c', 's3')],
      sessions: [sessionOf('s1'), sessionOf('s2', { deletedAt: AT as Session['createdAt'] })],
      stages: { s1: 'review' },
    });

    expect(entries.map((entry) => [entry.link.id, entry.stage])).toEqual([['a', 'review']]);
  });

  it('defaults a session with no derived stage to building', () => {
    const entries = chatSessionEntries({
      links: [linkOf('a', 's1')],
      sessions: [sessionOf('s1')],
      stages: {},
    });

    expect(entries[0]?.stage).toBe('building');
  });
});

describe('mostUrgentStage', () => {
  const entriesFor = (stages: ReadonlyArray<SessionStage>) =>
    chatSessionEntries({
      links: stages.map((_, index) => linkOf(`l${index}`, `s${index}`)),
      sessions: stages.map((_, index) => sessionOf(`s${index}`)),
      stages: Object.fromEntries(stages.map((stage, index) => [`s${index}`, stage])),
    });

  it('ranks attention over running over review over building over done', () => {
    expect(mostUrgentStage({ entries: entriesFor(['done', 'building', 'review']) })).toBe('review');
    expect(mostUrgentStage({ entries: entriesFor(['review', 'running', 'done']) })).toBe('running');
    expect(mostUrgentStage({ entries: entriesFor(['running', 'attention']) })).toBe('attention');
  });

  it('is null with no entries', () => {
    expect(mostUrgentStage({ entries: [] })).toBeNull();
  });
});
