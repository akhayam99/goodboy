import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type SessionId,
} from '@goodboy/types';
import { factKeyOf } from './factKeyOf';
import { failedChecksSince } from './failedChecksSince';
import { parseWatchSignature } from './parseWatchSignature';
import { readFailedOf } from './readFailedOf';
import { rerunNotes } from '../../rerunNotes';
import { wakeImplementerOf, type WakeCandidate } from './wakeImplementerOf';
import { watchedFactsOf } from './watchedFactsOf';
import type { WatchFact } from './watchFacts';
import { aMountGithub } from '../../../../../store/slices/github/testing/aMountGithub';

const LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const RELAY = brandId<MountId>({ value: 'mount-notify-relay' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });

type FactParams = {
  readonly mountId?: MountId;
  readonly checks: WatchFact['checks'];
  readonly prNumber?: number;
};

const fact = ({ mountId = LEDGER, checks, prNumber = 418 }: FactParams): WatchFact => ({
  sessionId: SESSION,
  mountId,
  prNumber,
  headSha: 'a41c9e2',
  checks,
});

describe('parseWatchSignature', () => {
  it('reads every entry of a signature back as a fact', () => {
    expect(
      parseWatchSignature({
        signature: `${SESSION}|${LEDGER}|418|a41c9e2|pending;${SESSION}|${RELAY}|52||;`,
      }),
    ).toEqual([
      fact({ checks: 'pending' }),
      { sessionId: SESSION, mountId: RELAY, prNumber: 52, headSha: '', checks: null },
    ]);
  });

  it('reads an empty signature as no facts', () => {
    expect(parseWatchSignature({ signature: '' })).toEqual([]);
  });
});

describe('watchedFactsOf', () => {
  it('watches a pending check and a mount that was just rerun, nothing else', () => {
    const facts = [
      fact({ checks: 'pending' }),
      fact({ mountId: RELAY, checks: 'failure' }),
      fact({ mountId: brandId<MountId>({ value: 'mount-payments-api' }), checks: 'success' }),
    ];
    expect(watchedFactsOf({ facts, rerunMountIds: new Set() }).map((item) => item.mountId)).toEqual(
      [LEDGER],
    );
    expect(
      watchedFactsOf({ facts, rerunMountIds: new Set([RELAY]) }).map((item) => item.mountId),
    ).toEqual([LEDGER, RELAY]);
  });
});

describe('failedChecksSince', () => {
  const previousOf = ({ items }: { readonly items: ReadonlyArray<WatchFact> }) =>
    new Map(items.map((item) => [factKeyOf({ fact: item }), item]));

  it('names a mount whose check went from pending to failure', () => {
    const next = [fact({ checks: 'failure' })];
    expect(
      failedChecksSince({ previous: previousOf({ items: [fact({ checks: 'pending' })] }), next }),
    ).toEqual(next);
  });

  it('ignores a failure that was already there and a mount seen for the first time', () => {
    const next = [fact({ checks: 'failure' }), fact({ mountId: RELAY, checks: 'failure' })];
    expect(
      failedChecksSince({ previous: previousOf({ items: [fact({ checks: 'failure' })] }), next }),
    ).toEqual([]);
  });

  it('ignores a failure on another request of the same mount', () => {
    expect(
      failedChecksSince({
        previous: previousOf({ items: [fact({ checks: 'pending' })] }),
        next: [fact({ checks: 'failure', prNumber: 419 })],
      }),
    ).toEqual([]);
  });
});

describe('readFailedOf', () => {
  const entryOf = ({ failedAt, fetchedAt }: { failedAt: string | null; fetchedAt: string }) => ({
    ...aMountGithub({ mountId: LEDGER, fetchedAt }),
    failedAt: failedAt === null ? null : brandId<IsoDateTime>({ value: failedAt }),
  });

  it('is true when the newest attempt failed after the last good read', () => {
    expect(
      readFailedOf({
        state: {
          mountGithub: {
            [LEDGER]: entryOf({
              failedAt: '2026-10-07T08:05:00.000Z',
              fetchedAt: '2026-10-07T08:00:00.000Z',
            }),
          },
        },
        mountIds: [LEDGER],
      }),
    ).toBe(true);
  });

  it('is false when a later read succeeded or nothing failed', () => {
    expect(
      readFailedOf({
        state: {
          mountGithub: {
            [LEDGER]: entryOf({
              failedAt: '2026-10-07T08:00:00.000Z',
              fetchedAt: '2026-10-07T08:05:00.000Z',
            }),
            [RELAY]: entryOf({ failedAt: null, fetchedAt: '2026-10-07T08:05:00.000Z' }),
          },
        },
        mountIds: [LEDGER, RELAY],
      }),
    ).toBe(false);
  });
});

describe('wakeImplementerOf', () => {
  const candidate = (overrides: Partial<WakeCandidate>): WakeCandidate => ({
    id: brandId<AgentId>({ value: 'agent-implementer' }),
    kind: 'implementer',
    status: 'completed',
    ordinal: 1,
    mountId: null,
    isDeleted: false,
    ...overrides,
  });

  it('picks the newest Implementer of the mount, then one with no mount', () => {
    const own = brandId<AgentId>({ value: 'agent-own' });
    const loose = brandId<AgentId>({ value: 'agent-loose' });
    expect(
      wakeImplementerOf({
        agents: [
          candidate({ id: loose, ordinal: 5 }),
          candidate({ id: own, ordinal: 2, mountId: LEDGER }),
        ],
        mountId: LEDGER,
      }),
    ).toBe(own);
    expect(wakeImplementerOf({ agents: [candidate({ id: loose })], mountId: LEDGER })).toBe(loose);
  });

  it('wakes no one when the Implementer is stopped, failed, deleted or of another mount', () => {
    expect(
      wakeImplementerOf({
        agents: [
          candidate({ status: 'stopped' }),
          candidate({ status: 'failed' }),
          candidate({ isDeleted: true }),
          candidate({ mountId: RELAY }),
          candidate({ kind: 'reviewer' }),
        ],
        mountId: LEDGER,
      }),
    ).toBeNull();
  });
});

describe('rerunNotes', () => {
  it('keeps a rerun for the grace window only', () => {
    rerunNotes.reset();
    rerunNotes.note({ mountId: LEDGER, at: Date.now() });
    expect(rerunNotes.snapshot()).toBe(LEDGER);
    rerunNotes.note({ mountId: RELAY, at: Date.now() - 10 * 60_000 });
    expect(rerunNotes.snapshot()).toBe(LEDGER);
    rerunNotes.reset();
    expect(rerunNotes.snapshot()).toBe('');
  });
});
