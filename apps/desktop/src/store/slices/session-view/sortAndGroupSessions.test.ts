// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type {
  IsoDateTime,
  Session,
  SessionId,
  SessionStage,
  SessionViewPrefs,
} from '@goodboy/types';
import { recentlyOpenedFirst, sortAndGroupSessions } from './sortAndGroupSessions';
import { DEFAULT_PREFS, NO_PROJECT_GROUP_KEY } from './types';

const at = (iso: string) => iso as IsoDateTime;

const session = (
  id: string,
  overrides: Partial<Pick<Session, 'goal' | 'createdAt' | 'updatedAt' | 'lastOpenedAt'>> = {},
): Session =>
  aSession({
    id: id as SessionId,
    goal: id,
    createdAt: at('2026-09-01T09:00:00.000Z'),
    updatedAt: at('2026-09-01T09:00:00.000Z'),
    ...overrides,
  });

const ids = (sessions: ReadonlyArray<Session>): ReadonlyArray<string> =>
  sessions.map((candidate) => candidate.id);

const order = (
  sessions: ReadonlyArray<Session>,
  prefs: Partial<SessionViewPrefs>,
  stageBySession: Readonly<Record<SessionId, SessionStage>> = {},
) =>
  sortAndGroupSessions({
    sessions,
    prefs: { ...DEFAULT_PREFS, ...prefs },
    githubState: {},
    stageBySession,
  });

describe('needs you first, then recently opened', () => {
  const opened = session('opened-today', {
    lastOpenedAt: at('2026-10-06T08:00:00.000Z'),
    updatedAt: at('2026-09-02T09:00:00.000Z'),
  });
  const openedLast = session('opened-last-week', {
    lastOpenedAt: at('2026-09-29T08:00:00.000Z'),
    updatedAt: at('2026-10-05T09:00:00.000Z'),
  });
  const waitingLong = session('waiting-long', { updatedAt: at('2026-10-01T09:00:00.000Z') });
  const waitingShort = session('waiting-short', { updatedAt: at('2026-10-05T09:00:00.000Z') });
  const stages = {
    [waitingLong.id]: 'attention',
    [waitingShort.id]: 'attention',
    [opened.id]: 'building',
    [openedLast.id]: 'running',
  } as const;

  it('puts every session that needs you on top, the oldest wait first', () => {
    const [group] = order([opened, waitingShort, openedLast, waitingLong], {}, stages);
    expect(ids(group?.sessions ?? []).slice(0, 2)).toEqual(['waiting-long', 'waiting-short']);
  });

  it('follows the last time you opened a session for the rest', () => {
    const [group] = order([openedLast, waitingShort, opened, waitingLong], {}, stages);
    expect(ids(group?.sessions ?? []).slice(2)).toEqual(['opened-today', 'opened-last-week']);
  });

  it('does not move a running session when its agent writes', () => {
    const before = order([opened, openedLast], {}, stages)[0]?.sessions ?? [];
    const busy = { ...openedLast, updatedAt: at('2026-10-06T10:00:00.000Z') };
    const after = order([opened, busy], {}, stages)[0]?.sessions ?? [];
    expect(ids(after)).toEqual(ids(before));
  });

  it('falls back to the last activity for a session never opened', () => {
    const never = session('never-opened', { updatedAt: at('2026-10-02T09:00:00.000Z') });
    const older = session('older', { lastOpenedAt: at('2026-10-01T09:00:00.000Z') });
    const [group] = order([older, never], {});
    expect(ids(group?.sessions ?? [])).toEqual(['never-opened', 'older']);
  });

  it('moves a session to the top of the rest the moment it is opened', () => {
    const reopened = { ...openedLast, lastOpenedAt: at('2026-10-06T11:00:00.000Z') };
    const [group] = order([opened, reopened], {}, stages);
    expect(ids(group?.sessions ?? [])).toEqual(['opened-last-week', 'opened-today']);
  });
});

describe('the other sorts', () => {
  const a = session('Acme invoice import', {
    createdAt: at('2026-09-01T09:00:00.000Z'),
    updatedAt: at('2026-10-03T09:00:00.000Z'),
  });
  const b = session('northwind csv mapper', {
    createdAt: at('2026-09-03T09:00:00.000Z'),
    updatedAt: at('2026-10-01T09:00:00.000Z'),
  });
  const c = session('Cascadia sso callback', {
    createdAt: at('2026-09-02T09:00:00.000Z'),
    updatedAt: at('2026-10-02T09:00:00.000Z'),
  });

  it('sorts alphabetically without regard to case', () => {
    const [group] = order([b, c, a], { sort: 'goal' });
    expect(ids(group?.sessions ?? [])).toEqual([
      'Acme invoice import',
      'Cascadia sso callback',
      'northwind csv mapper',
    ]);
  });

  it('sorts by last activity, newest first', () => {
    const [group] = order([b, c, a], { sort: 'updatedAt' });
    expect(ids(group?.sessions ?? [])).toEqual([
      'Acme invoice import',
      'Cascadia sso callback',
      'northwind csv mapper',
    ]);
  });

  it('sorts by creation, newest first', () => {
    const [group] = order([a, b, c], { sort: 'createdAt' });
    expect(ids(group?.sessions ?? [])).toEqual([
      'northwind csv mapper',
      'Cascadia sso callback',
      'Acme invoice import',
    ]);
  });
});

describe('groups', () => {
  const retry = session('Retry policy for 429s');
  const webhook = session('Fix webhook retries');
  const ledger = session('Ledger export speedup');
  const loose = session('Scratch notes');

  it('groups by stage with needs you first and done last', () => {
    const groups = order(
      [ledger, webhook, retry],
      { group: 'stage' },
      {
        [retry.id]: 'attention',
        [webhook.id]: 'running',
        [ledger.id]: 'done',
      },
    );
    expect(groups.map((group) => group.key)).toEqual(['attention', 'running', 'done']);
  });

  it('groups by project, named, alphabetical, with no project last', () => {
    const groups = sortAndGroupSessions({
      sessions: [loose, ledger, webhook, retry],
      prefs: { ...DEFAULT_PREFS, group: 'project' },
      githubState: {},
      projectBySession: {
        [retry.id]: { id: 'p-payments', name: 'payments-api' },
        [webhook.id]: { id: 'p-payments', name: 'payments-api' },
        [ledger.id]: { id: 'p-ledger', name: 'ledger-core' },
        [loose.id]: null,
      },
    });
    expect(groups.map((group) => [group.key, group.label])).toEqual([
      ['p-ledger', 'ledger-core'],
      ['p-payments', 'payments-api'],
      [NO_PROJECT_GROUP_KEY, 'No project'],
    ]);
    expect(ids(groups[1]?.sessions ?? [])).toHaveLength(2);
  });

  it('keeps the chosen sort inside every group', () => {
    const groups = order(
      [retry, webhook],
      { group: 'stage', sort: 'goal' },
      { [retry.id]: 'running', [webhook.id]: 'running' },
    );
    expect(ids(groups[0]?.sessions ?? [])).toEqual([
      'Fix webhook retries',
      'Retry policy for 429s',
    ]);
  });

  it('returns one flat group when nothing is grouped', () => {
    const groups = order([retry, webhook], {});
    expect(groups.map((group) => group.key)).toEqual(['all']);
  });
});

describe('recentlyOpenedFirst', () => {
  it('orders by the last open and falls back to the last activity', () => {
    const first = session('first', { lastOpenedAt: at('2026-10-06T09:00:00.000Z') });
    const second = session('second', { updatedAt: at('2026-10-05T09:00:00.000Z') });
    const third = session('third', { lastOpenedAt: at('2026-10-04T09:00:00.000Z') });
    expect(ids(recentlyOpenedFirst([third, second, first]))).toEqual(['first', 'second', 'third']);
  });
});
