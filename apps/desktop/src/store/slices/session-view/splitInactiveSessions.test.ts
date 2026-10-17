// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type { Session, SessionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { splitInactiveSessions } from './splitInactiveSessions';
import { INACTIVE_GROUP_KEY } from './types';

type SlugParams = {
  readonly slug: string;
};

type IdsParams = {
  readonly sessions: ReadonlyArray<Session>;
};

const sessionOf = ({ slug }: SlugParams): Session =>
  aSession({ id: brandId<SessionId>({ value: `session-${slug}` }), goal: slug });

const ids = ({ sessions }: IdsParams) => sessions.map((session) => session.id);

describe('splitInactiveSessions', () => {
  const settle = sessionOf({ slug: 'settle' });
  const queue = sessionOf({ slug: 'queue' });
  const digest = sessionOf({ slug: 'digest' });
  const retries = sessionOf({ slug: 'retries' });

  it('returns the groups untouched when nothing is inactive', () => {
    const groups = [{ key: 'all', sessions: [settle, queue] }];

    expect(splitInactiveSessions({ groups, inactiveSince: new Map() })).toBe(groups);
  });

  it('moves the inactive sessions into one last Inactive group, newest first', () => {
    const result = splitInactiveSessions({
      groups: [{ key: 'all', sessions: [settle, queue, digest, retries] }],
      inactiveSince: new Map([
        [queue.id, 100],
        [retries.id, 300],
        [digest.id, 200],
      ]),
    });

    expect(
      result.map((group) => [group.key, group.label, ids({ sessions: group.sessions })]),
    ).toEqual([
      ['all', undefined, [settle.id]],
      [INACTIVE_GROUP_KEY, 'Inactive', [retries.id, digest.id, queue.id]],
    ]);
  });

  it('pulls them out of every group, drops a group left empty and keeps the order of the rest', () => {
    const result = splitInactiveSessions({
      groups: [
        { key: 'ledger-core', label: 'ledger-core', sessions: [settle, queue] },
        { key: 'notify-relay', label: 'notify-relay', sessions: [digest] },
        { key: 'payments-api', label: 'payments-api', sessions: [retries] },
      ],
      inactiveSince: new Map([
        [queue.id, 100],
        [digest.id, 100],
      ]),
    });

    expect(result.map((group) => [group.key, ids({ sessions: group.sessions })])).toEqual([
      ['ledger-core', [settle.id]],
      ['payments-api', [retries.id]],
      [INACTIVE_GROUP_KEY, [digest.id, queue.id]],
    ]);
  });
});
