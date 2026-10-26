// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { groupIssuesBy } from './groupIssuesBy';

type Ticket = {
  readonly id: string;
  readonly lane: 'now' | 'next' | 'later';
  readonly updatedAt: string;
};

const ticket = (overrides: Partial<Ticket> & Pick<Ticket, 'id'>): Ticket => ({
  lane: 'now',
  updatedAt: '2026-07-01T10:00:00Z',
  ...overrides,
});

const LABELS = { now: 'Now', next: 'Next', later: 'Later' } as const;

const groupsOf = ({
  issues,
  sessionIdByExternalId = new Map(),
  order,
}: {
  readonly issues: ReadonlyArray<Ticket>;
  readonly sessionIdByExternalId?: ReadonlyMap<string, SessionId>;
  readonly order: ReadonlyArray<Ticket['lane']> | null;
}) =>
  groupIssuesBy({
    issues,
    sessionIdByExternalId,
    externalIdOf: ({ issue }) => issue.id,
    keyOf: ({ issue }) => issue.lane,
    labelOf: ({ key }) => LABELS[key],
    updatedAtOf: ({ issue }) => issue.updatedAt,
    order,
  });

describe('groupIssuesBy', () => {
  it('follows the declared order and drops the groups nothing falls into', () => {
    const groups = groupsOf({
      issues: [ticket({ id: 'a', lane: 'later' }), ticket({ id: 'b', lane: 'now' })],
      order: ['now', 'next', 'later'],
    });

    expect(groups.map((group) => group.label)).toEqual(['Now', 'Later']);
  });

  it('sorts the keys alphabetically when no order is declared', () => {
    const groups = groupsOf({
      issues: [ticket({ id: 'a', lane: 'next' }), ticket({ id: 'b', lane: 'later' })],
      order: null,
    });

    expect(groups.map((group) => group.key)).toEqual(['later', 'next']);
  });

  it('puts the newest row first inside a group', () => {
    const [group] = groupsOf({
      issues: [
        ticket({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
        ticket({ id: 'new', updatedAt: '2026-05-01T00:00:00Z' }),
        ticket({ id: 'mid', updatedAt: '2026-03-01T00:00:00Z' }),
      ],
      order: ['now'],
    });

    expect(group?.rows.map((row) => row.issue.id)).toEqual(['new', 'mid', 'old']);
  });

  it('names the session of a row by its external id, and leaves the rest empty', () => {
    const [group] = groupsOf({
      issues: [ticket({ id: 'a' }), ticket({ id: 'b' })],
      sessionIdByExternalId: new Map([['a', brandId<SessionId>({ value: 'session-1' })]]),
      order: ['now'],
    });

    expect(group?.rows.map((row) => [row.issue.id, row.sessionId])).toEqual([
      ['a', 'session-1'],
      ['b', null],
    ]);
  });

  it('returns nothing for no issues', () => {
    expect(groupsOf({ issues: [], order: ['now'] })).toEqual([]);
  });
});
