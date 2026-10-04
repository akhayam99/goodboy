// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session } from '@goodboy/types';
import { goalFromIssue } from '../integrations/linear/goal-from-issue';
import { sessionDisplayTitle, sessionTitle } from './sessionTitle';

const sessionWith = (goal: unknown): Session => ({ goal }) as Session;

describe('sessionDisplayTitle', () => {
  const tasks = [{ identifier: 'HBL-412' }, { identifier: 'HBL-413' }];

  it('drops a leading id that a linked task already shows', () => {
    expect(
      sessionDisplayTitle({
        session: sessionWith('[HBL-412] Retried webhooks post a second credit'),
        tasks,
      }),
    ).toBe('Retried webhooks post a second credit');
  });

  it('drops several leading ids that all belong to linked tasks', () => {
    expect(
      sessionDisplayTitle({ session: sessionWith('[HBL-412] [HBL-413] Retried webhooks'), tasks }),
    ).toBe('Retried webhooks');
  });

  it('keeps an id that no linked task carries', () => {
    expect(sessionDisplayTitle({ session: sessionWith('[HBL-999] Retried webhooks'), tasks })).toBe(
      '[HBL-999] Retried webhooks',
    );
  });

  it('keeps the id when the session has no linked task', () => {
    expect(
      sessionDisplayTitle({ session: sessionWith('[HBL-412] Retried webhooks'), tasks: [] }),
    ).toBe('[HBL-412] Retried webhooks');
  });

  it('keeps the title whole when nothing would be left', () => {
    expect(sessionDisplayTitle({ session: sessionWith('[HBL-412] '), tasks })).toBe('[HBL-412] ');
  });

  it('leaves the goal a provider receives byte-identical for a ticket goal', () => {
    const goal = goalFromIssue({
      issue: {
        id: 'lin-1',
        identifier: 'HBL-412',
        title: 'Retried webhooks post a second credit',
        description: 'Replays double-post in ledger-core.',
        url: 'https://linear.app/harborline/issue/HBL-412',
        state: { name: 'In Progress', type: 'started' },
        team: { key: 'HBL' },
        updatedAt: '2026-10-01T10:00:00Z',
      },
    });
    const session = sessionWith(goal);

    expect(sessionDisplayTitle({ session, tasks }).startsWith('Retried webhooks')).toBe(true);
    expect(session.goal).toBe(
      '[HBL-412] Retried webhooks post a second credit\n\nReplays double-post in ledger-core.',
    );
    expect(sessionTitle({ session })).toBe(goal);
  });

  it('keeps an id in the middle of the title', () => {
    expect(sessionDisplayTitle({ session: sessionWith('Fix HBL-412 retries'), tasks })).toBe(
      'Fix HBL-412 retries',
    );
  });
});

describe('sessionTitle', () => {
  it('keeps a title the session already carries', () => {
    expect(sessionTitle({ session: sessionWith('Refactor auth') })).toBe('Refactor auth');
  });

  it('falls back for an empty title', () => {
    expect(sessionTitle({ session: sessionWith('') })).toBe('Untitled session');
  });

  it('falls back for a whitespace-only title', () => {
    expect(sessionTitle({ session: sessionWith('   ') })).toBe('Untitled session');
  });

  it('falls back for a missing title', () => {
    expect(sessionTitle({ session: sessionWith(undefined) })).toBe('Untitled session');
  });

  it('falls back for a missing session', () => {
    expect(sessionTitle({ session: null })).toBe('Untitled session');
  });
});
