import { describe, expect, it } from 'vitest';
import { deliverySupportLine } from './resolveDeliverySupport';
import type { ResolveQueueDelivery, ResolveQueueRow } from './buildResolveQueueRows';

const rowOf = ({
  status,
  delivery,
}: {
  readonly status: ResolveQueueRow['status'];
  readonly delivery: ResolveQueueDelivery | null;
}): ResolveQueueRow => ({ status, delivery }) as unknown as ResolveQueueRow;

describe('deliverySupportLine', () => {
  it('says reply pending for a ready_to_push row with no delivery yet', () => {
    expect(deliverySupportLine({ row: rowOf({ status: 'approved', delivery: null }) })).toBe(
      'Reply pending',
    );
  });

  it('reports the posted reply on a ready_to_push row whose resolve is still in flight', () => {
    const delivery: ResolveQueueDelivery = {
      isReplyPosted: true,
      replyPostedAt: 1,
      isThreadResolved: false,
      resolvedAt: null,
      isComplete: false,
      replyBody: 'We are keeping this as it is',
    };
    expect(deliverySupportLine({ row: rowOf({ status: 'approved', delivery }) })).toBe(
      'Reply posted · Left open on GitHub',
    );
  });

  it('reports the posted reply on a wont_fix row whose resolve is still in flight', () => {
    const delivery: ResolveQueueDelivery = {
      isReplyPosted: true,
      replyPostedAt: 1,
      isThreadResolved: false,
      resolvedAt: null,
      isComplete: false,
      replyBody: 'We are keeping this as it is',
    };
    expect(deliverySupportLine({ row: rowOf({ status: 'approved', delivery }) })).toBe(
      'Reply posted · Left open on GitHub',
    );
  });

  it('shows nothing for an undecided row with no delivery', () => {
    expect(deliverySupportLine({ row: rowOf({ status: 'ready', delivery: null }) })).toBe(null);
  });
});
