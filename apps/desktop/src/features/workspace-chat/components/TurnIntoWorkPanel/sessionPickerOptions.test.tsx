import { describe, expect, it } from 'vitest';
import type { Session, SessionStage } from '@goodboy/types';
import { sessionPickerOptions } from './sessionPickerOptions';

const NOW_MS = Date.parse('2026-09-28T12:00:00.000Z');

const sessionOf = ({ id, goal, updatedAt }: Pick<Session, 'id' | 'goal' | 'updatedAt'>): Session =>
  ({ id, goal, updatedAt }) as Session;

const SESSIONS = [
  sessionOf({
    id: 'a' as Session['id'],
    goal: 'Refund flow',
    updatedAt: '2026-09-28T09:00:00.000Z' as Session['updatedAt'],
  }),
  sessionOf({
    id: 'b' as Session['id'],
    goal: 'Audit postings',
    updatedAt: '2026-09-27T09:00:00.000Z' as Session['updatedAt'],
  }),
  sessionOf({
    id: 'c' as Session['id'],
    goal: 'Retry notices',
    updatedAt: '2026-09-28T11:00:00.000Z' as Session['updatedAt'],
  }),
];

describe('sessionPickerOptions', () => {
  it('lists active sessions first, newest first, then the finished ones', () => {
    const stages: Record<string, SessionStage> = { a: 'running', b: 'done', c: 'building' };

    const options = sessionPickerOptions({
      sessions: SESSIONS,
      stages,
      mounts: { a: [{ projectId: 'p1' }, { projectId: 'p2' }] } as never,
      projectNames: new Map([
        ['p1', 'payments-api'],
        ['p2', 'ledger-core'],
      ]),
      nowMs: NOW_MS,
    });

    expect(options.map((option) => [option.label, option.group])).toEqual([
      ['Retry notices', 'Active'],
      ['Refund flow', 'Active'],
      ['Audit postings', 'Recent'],
    ]);
    expect(options[1]?.description).toBe('payments-api, ledger-core');
    expect(options[1]?.keywords).toBe('payments-api ledger-core');
    expect(options[0]?.description).toBeUndefined();
  });
});
