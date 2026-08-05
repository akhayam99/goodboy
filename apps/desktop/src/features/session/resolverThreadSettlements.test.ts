import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PendingResolution, SessionId } from '@goodboy/types';
import { resolverThreadSettlements } from './resolverThreadSettlements';

const NO_PENDING: ReadonlyArray<PendingResolution> = [];

const NOTHING_CLOSED: ReadonlySet<string> = new Set();

describe('resolverThreadSettlements', () => {
  it('marks the thread the local ledger already closed', () => {
    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: {},
      pendingResolutions: NO_PENDING,
      closedThreadIds: new Set(['PRRT_1']),
    });

    expect(settlement?.kind).toBe('open');
    expect(settlement?.isClosed).toBe(true);
  });

  it('leaves a thread nobody closed to the operator', () => {
    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: {},
      pendingResolutions: NO_PENDING,
      closedThreadIds: NOTHING_CLOSED,
    });

    expect(settlement?.kind).toBe('open');
    expect(settlement?.isClosed).toBe(false);
  });

  it('closes one thread of an agent without touching its sibling', () => {
    const settlements = resolverThreadSettlements({
      threadIds: ['PRRT_1', 'PRRT_2'],
      outcomes: {
        PRRT_1: { kind: 'resolved', commitSha: 'abc1234' },
        PRRT_2: { kind: 'wontfix', reason: 'unreachable branch' },
      },
      pendingResolutions: NO_PENDING,
      closedThreadIds: new Set(['PRRT_1']),
    });

    expect(settlements[0]?.isClosed).toBe(true);
    expect(settlements[1]?.isClosed).toBe(false);
  });

  it('keeps the verdict of a closed thread readable', () => {
    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: { PRRT_1: { kind: 'wontfix', reason: 'covered elsewhere' } },
      pendingResolutions: NO_PENDING,
      closedThreadIds: new Set(['PRRT_1']),
    });

    expect(settlement?.kind).toBe('wontfix');
    expect(settlement?.reason).toBe('covered elsewhere');
    expect(settlement?.isClosed).toBe(true);
  });

  it('never reads a queued row without a stored verdict as resolved', () => {
    const legacy = {
      id: 'pending-legacy',
      sessionId: 'session-1' as SessionId,
      prNumber: 1,
      threadId: 'PRRT_1',
      commitSha: 'abcdef1234567890',
      reply: 'legacy resolver reply',
      outcome: null,
      replyPostedAt: null,
      createdAt: '2026-05-28T00:00:00.000Z' as IsoDateTime,
    } satisfies PendingResolution;

    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: {},
      pendingResolutions: [legacy],
      closedThreadIds: NOTHING_CLOSED,
    });

    expect(settlement?.kind).toBe('open');
    expect(settlement?.isQueued).toBe(true);
    expect(settlement?.reply).toBe('legacy resolver reply');
  });

  it('shows the persisted verdict of a queued row after a restart, instead of open', () => {
    const survivor = {
      id: 'pending-survivor',
      sessionId: 'session-1' as SessionId,
      prNumber: 1,
      threadId: 'PRRT_1',
      commitSha: 'abcdef1234567890',
      reply: 'fixed it',
      outcome: 'resolved',
      replyPostedAt: '2026-05-28T00:00:00.000Z' as IsoDateTime,
      createdAt: '2026-05-28T00:00:00.000Z' as IsoDateTime,
    } satisfies PendingResolution;

    const [settlement] = resolverThreadSettlements({
      threadIds: ['PRRT_1'],
      outcomes: {},
      pendingResolutions: [survivor],
      closedThreadIds: NOTHING_CLOSED,
    });

    expect(settlement?.kind).toBe('resolved');
    expect(settlement?.isQueued).toBe(true);
  });
});
