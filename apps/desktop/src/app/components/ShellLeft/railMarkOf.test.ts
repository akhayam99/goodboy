import { describe, expect, it } from 'vitest';
import { railMarkOf } from './railMarkOf';

const signal = {
  count: 3,
  isWarning: true,
  isUnread: false,
  fact: '3 sessions need you',
} as const;

describe('railMarkOf', () => {
  it('counts the sessions that need you on the Board in the warning tone', () => {
    expect(railMarkOf({ id: 'board', signal: { ...signal, tone: 'warning' } })).toEqual({
      kind: 'count',
      count: 3,
      name: '3 sessions need you',
      tone: 'warning',
    });
  });

  it('turns the Board count red as soon as one counted session is broken', () => {
    expect(railMarkOf({ id: 'board', signal: { ...signal, tone: 'danger' } })).toMatchObject({
      tone: 'danger',
    });
  });

  it('draws no mark for a Board with only quiet sessions', () => {
    expect(
      railMarkOf({ id: 'board', signal: { ...signal, isWarning: false, tone: 'neutral' } }),
    ).toBeNull();
  });

  it('dots Tasks for new tasks and marks no other place', () => {
    const unread = { ...signal, isWarning: false, isUnread: true, fact: '2 new' };
    expect(railMarkOf({ id: 'inbox', signal: unread })).toEqual({ kind: 'dot', name: '2 new' });
    expect(railMarkOf({ id: 'chat', signal: unread })).toBeNull();
  });
});
