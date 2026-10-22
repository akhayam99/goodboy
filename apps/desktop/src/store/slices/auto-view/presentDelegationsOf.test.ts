import { describe, expect, it } from 'vitest';
import type { AutoDelegation } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';
import { aDelegation } from '../../../features/auto/testing/autoViewFixtures';
import { presentDelegationsOf } from './presentDelegationsOf';

const MINUTE_MS = 60_000;

type LineParams = {
  readonly key: string;
  readonly minute: number;
  readonly outcome: AutoDelegation['outcome'];
  readonly retryOf?: AutoDelegation | null;
  readonly mountId?: string;
};

const lineOf = ({
  key,
  minute,
  outcome,
  retryOf = null,
  mountId = 'mount-ledger-core',
}: LineParams): AutoDelegation => ({
  ...aDelegation({ key, role: 'implementer', state: 'settled', outcome }),
  target: { mountId },
  retryOf: retryOf === null ? null : retryOf.id,
  createdAt: minute * MINUTE_MS,
});

const idsOf = (delegations: ReadonlyArray<AutoDelegation>) =>
  delegations.map((delegation) => delegation.id);

const goneOf = (...delegations: ReadonlyArray<AutoDelegation>): ReadonlySet<AgentId> =>
  new Set(delegations.map((delegation) => delegation.childAgentId));

describe('presentDelegationsOf', () => {
  it('keeps every delegation when no child is gone', () => {
    const first = lineOf({ key: 'first', minute: 1, outcome: 'failed' });
    const delegations = [first];

    expect(presentDelegationsOf({ delegations, goneChildIds: new Set() })).toBe(delegations);
  });

  it('drops a gone child and the failed attempts its retry replaced', () => {
    const first = lineOf({ key: 'first', minute: 1, outcome: 'failed' });
    const retry = lineOf({ key: 'retry', minute: 2, outcome: 'timed_out', retryOf: first });
    const other = lineOf({ key: 'other', minute: 3, outcome: 'failed', mountId: 'mount-notify' });

    const present = presentDelegationsOf({
      delegations: [first, retry, other],
      goneChildIds: goneOf(retry),
    });

    expect(idsOf(present)).toEqual([other.id]);
  });

  it('drops the earlier failed attempt on the same branch that a gone child superseded', () => {
    const first = lineOf({ key: 'first', minute: 1, outcome: 'stopped' });
    const done = lineOf({ key: 'done', minute: 2, outcome: 'completed' });
    const gone = lineOf({ key: 'gone', minute: 3, outcome: 'failed' });

    const present = presentDelegationsOf({
      delegations: [first, done, gone],
      goneChildIds: goneOf(gone),
    });

    expect(idsOf(present)).toEqual([done.id]);
  });

  it('keeps a later attempt that is still in the session', () => {
    const gone = lineOf({ key: 'gone', minute: 1, outcome: 'failed' });
    const later = lineOf({ key: 'later', minute: 2, outcome: 'failed', retryOf: gone });

    const present = presentDelegationsOf({
      delegations: [gone, later],
      goneChildIds: goneOf(gone),
    });

    expect(idsOf(present)).toEqual([later.id]);
  });
});
