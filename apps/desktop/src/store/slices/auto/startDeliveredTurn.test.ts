import { describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { startDeliveredTurn } from './startDeliveredTurn';

type WaitParams = {
  readonly acceptTimeoutMs: number;
};

const waitedMs = async ({ acceptTimeoutMs }: WaitParams): Promise<ReadonlyArray<number>> => {
  const sleeps: Array<number> = [];
  const outcome = await startDeliveredTurn({
    deps: {
      sendTurn: () => new Promise(() => undefined),
      lookupDeliveryRun: vi.fn(async () => null),
      readRunCostUsd: vi.fn(async () => null),
      sleep: async ({ ms }) => {
        sleeps.push(ms);
      },
      nowMs: () => 0,
    },
    input: { sessionId: brandId<SessionId>({ value: 'session-harborline' }), content: 'Go' },
    runId: undefined,
    deliveryId: 'delivery-1',
    acceptTimeoutMs,
    onEnded: vi.fn(),
  });
  expect(outcome).toEqual({
    kind: 'refused',
    message: 'The turn did not start in time.',
    isLeaseDenied: false,
  });
  return sleeps;
};

describe('how often the registry is asked whether a turn started', () => {
  it('asks quickly at first, so a normal start is seen at once', async () => {
    const sleeps = await waitedMs({ acceptTimeoutMs: 2_000 });
    expect(sleeps.slice(0, 40).every((ms) => ms === 50)).toBe(true);
  });

  it('slows down after two seconds, so a long wait for the writer is cheap', async () => {
    const sleeps = await waitedMs({ acceptTimeoutMs: 20_000 });
    expect(sleeps.slice(40).every((ms) => ms === 500)).toBe(true);
  });

  it('keeps the number of asks small over a long wait and exact over a short one', async () => {
    expect((await waitedMs({ acceptTimeoutMs: 1_000 })).length).toBe(20);
    expect((await waitedMs({ acceptTimeoutMs: 2_000 })).length).toBe(40);
    expect((await waitedMs({ acceptTimeoutMs: 20_000 })).length).toBe(76);
    expect((await waitedMs({ acceptTimeoutMs: 31 * 60_000 })).length).toBeLessThan(4_000);
  });
});
