import { describe, expect, it } from 'vitest';
import type { ResolvePublicationThread } from '@goodboy/types';
import { publicationOutcome } from './publicationOutcome';

const receiptOf = (patch: Partial<ResolvePublicationThread>): ResolvePublicationThread => ({
  publicationId: 'pub-1',
  threadId: 'PRRT_1',
  revision: 1,
  priorState: 'answered',
  sourceFingerprint: null,
  operationId: 'op-1',
  replyBody: 'Fixed',
  replyPhase: 'posted',
  replyId: 'IC_1',
  replyAttemptedAt: 1,
  replyPostedAt: 2,
  resolvePhase: 'resolved',
  resolvedAt: 3,
  error: null,
  ...patch,
});

describe('publicationOutcome', () => {
  it('counts a thread as resolved only when GitHub confirmed it', () => {
    const outcome = publicationOutcome({
      receipts: [
        receiptOf({ threadId: 'PRRT_1' }),
        receiptOf({ threadId: 'PRRT_2', resolvedAt: null }),
      ],
      pushedHead: 'abc1234',
    });

    expect(outcome).toEqual({
      pushed: true,
      pushedHead: 'abc1234',
      total: 2,
      replies: 2,
      replied: 2,
      closed: 2,
      resolved: 1,
      leftOpen: 1,
      failed: 0,
      error: null,
    });
  });

  it('keeps the posted reply apart from the resolve step that failed after it', () => {
    const outcome = publicationOutcome({
      receipts: [
        receiptOf({ threadId: 'PRRT_1' }),
        receiptOf({
          threadId: 'PRRT_2',
          resolvePhase: 'pending',
          resolvedAt: null,
          error: 'rate limited by GitHub',
        }),
        receiptOf({
          threadId: 'PRRT_3',
          replyPhase: 'uncertain',
          replyPostedAt: null,
          resolvePhase: 'pending',
          resolvedAt: null,
          error: 'network timeout',
        }),
      ],
      pushedHead: null,
    });

    expect(outcome).toMatchObject({
      pushed: false,
      replied: 2,
      replies: 3,
      closed: 1,
      resolved: 1,
      failed: 2,
      error: 'rate limited by GitHub',
    });
  });

  it('does not count a reply-only thread as closed', () => {
    const outcome = publicationOutcome({
      receipts: [receiptOf({ resolvePhase: 'skipped', resolvedAt: null })],
      pushedHead: null,
    });

    expect(outcome).toMatchObject({ replied: 1, closed: 0, resolved: 0, leftOpen: 0 });
  });
});
