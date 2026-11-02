// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type { Session, SessionId, SessionStage } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { splitDoneSessions } from './splitDoneSessions';
import { DONE_GROUP_KEY } from './types';

type SlugParams = {
  readonly slug: string;
};

type IdsParams = {
  readonly sessions: ReadonlyArray<Session>;
};

const sessionOf = ({ slug }: SlugParams): Session =>
  aSession({ id: brandId<SessionId>({ value: `session-${slug}` }), goal: slug });

const ids = ({ sessions }: IdsParams) => sessions.map((session) => session.id);

describe('splitDoneSessions', () => {
  const settle = sessionOf({ slug: 'settle' });
  const queue = sessionOf({ slug: 'queue' });
  const digest = sessionOf({ slug: 'digest' });
  const retries = sessionOf({ slug: 'retries' });
  const stages: Record<SessionId, SessionStage> = {
    [settle.id]: 'running',
    [queue.id]: 'done',
    [digest.id]: 'done',
    [retries.id]: 'review',
  };

  it('returns the groups untouched when nothing is done', () => {
    const groups = [{ key: 'all', sessions: [settle, retries] }];

    expect(splitDoneSessions({ groups, stageBySession: stages, exemptIds: new Set() })).toBe(
      groups,
    );
  });

  it('moves the done sessions into one last Done group in their own order', () => {
    const result = splitDoneSessions({
      groups: [{ key: 'all', sessions: [settle, digest, retries, queue] }],
      stageBySession: stages,
      exemptIds: new Set(),
    });

    expect(
      result.map((group) => [group.key, group.label, ids({ sessions: group.sessions })]),
    ).toEqual([
      ['all', undefined, [settle.id, retries.id]],
      [DONE_GROUP_KEY, 'Done', [digest.id, queue.id]],
    ]);
  });

  it('pulls them out of every group and drops a group left empty', () => {
    const result = splitDoneSessions({
      groups: [
        { key: 'ledger-core', label: 'ledger-core', sessions: [settle, queue] },
        { key: 'notify-relay', label: 'notify-relay', sessions: [digest] },
        { key: 'payments-api', label: 'payments-api', sessions: [retries] },
      ],
      stageBySession: stages,
      exemptIds: new Set(),
    });

    expect(result.map((group) => [group.key, ids({ sessions: group.sessions })])).toEqual([
      ['ledger-core', [settle.id]],
      ['payments-api', [retries.id]],
      [DONE_GROUP_KEY, [queue.id, digest.id]],
    ]);
  });

  it('keeps the open and the pinned session where they are', () => {
    const result = splitDoneSessions({
      groups: [{ key: 'all', sessions: [queue, digest] }],
      stageBySession: stages,
      exemptIds: new Set([queue.id]),
    });

    expect(result.map((group) => [group.key, ids({ sessions: group.sessions })])).toEqual([
      ['all', [queue.id]],
      [DONE_GROUP_KEY, [digest.id]],
    ]);
  });

  it('leaves a stage grouping alone, where Done already is a group', () => {
    const groups = [
      { key: 'running', sessions: [settle] },
      { key: DONE_GROUP_KEY, sessions: [queue, digest] },
    ];

    expect(splitDoneSessions({ groups, stageBySession: stages, exemptIds: new Set() })).toBe(
      groups,
    );
  });
});
