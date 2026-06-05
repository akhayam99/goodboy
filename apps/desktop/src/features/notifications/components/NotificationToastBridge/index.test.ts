import { describe, expect, it } from 'vitest';
import type { Notification } from '@goodboy/db';
import type { Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';
import { notificationContext, pickFreshFailures } from './';

function notif(over: Partial<Notification> & { id: string }): Notification {
  return {
    ts: '2026-06-05T12:00:00.000Z',
    kind: 'error',
    title: 'something failed',
    body: null,
    severity: 'error',
    sessionId: null,
    workspaceId: null,
    read: false,
    ...over,
  } as Notification;
}

const SINCE = new Date('2026-06-05T12:00:00.000Z').getTime();

describe('pickFreshFailures', () => {
  it('returns only errors and warnings newer than the cutoff', () => {
    const seen = new Set<string>();
    const list = [
      notif({ id: 'old', ts: '2026-06-05T11:59:59.000Z', severity: 'error' }),
      notif({ id: 'e1', ts: '2026-06-05T12:00:01.000Z', severity: 'error' }),
      notif({ id: 'w1', ts: '2026-06-05T12:00:02.000Z', severity: 'warning' }),
      notif({ id: 'i1', ts: '2026-06-05T12:00:03.000Z', severity: 'info' }),
      notif({ id: 's1', ts: '2026-06-05T12:00:04.000Z', severity: 'success' }),
    ];
    expect(pickFreshFailures(list, seen, SINCE).map((n) => n.id)).toEqual(['e1', 'w1']);
  });

  it('marks every scanned id seen so historical and ignored ones never toast', () => {
    const seen = new Set<string>();
    const list = [
      notif({ id: 'old', ts: '2026-06-05T11:59:59.000Z' }),
      notif({ id: 'i1', ts: '2026-06-05T12:00:03.000Z', severity: 'info' }),
    ];
    pickFreshFailures(list, seen, SINCE);
    expect(seen).toEqual(new Set(['old', 'i1']));
  });

  it('does not return a notification twice across calls', () => {
    const seen = new Set<string>();
    const list = [notif({ id: 'e1', ts: '2026-06-05T12:00:01.000Z' })];
    expect(pickFreshFailures(list, seen, SINCE).map((n) => n.id)).toEqual(['e1']);
    expect(pickFreshFailures(list, seen, SINCE)).toEqual([]);
  });
});

describe('notificationContext', () => {
  const workspaces = [{ id: 'w1' as WorkspaceId, name: 'app-web' } as Workspace];
  const sessions = [{ id: 's1' as SessionId, goal: 'GRW-902 change therapist' } as Session];

  it('joins workspace name and session goal', () => {
    const n = notif({ id: 'n', workspaceId: 'w1' as WorkspaceId, sessionId: 's1' as SessionId });
    expect(notificationContext(n, sessions, workspaces)).toBe('app-web · GRW-902 change therapist');
  });

  it('falls back to a placeholder for a blank goal', () => {
    const blank = [{ id: 's2' as SessionId, goal: '   ' } as Session];
    const n = notif({ id: 'n', sessionId: 's2' as SessionId });
    expect(notificationContext(n, blank, workspaces)).toBe('untitled session');
  });

  it('returns undefined when neither session nor workspace resolves', () => {
    expect(notificationContext(notif({ id: 'n' }), sessions, workspaces)).toBeUndefined();
  });
});
