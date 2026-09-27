// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { NudgeEvent } from '@goodboy/db';

const { listNudgeEvents, insertNudgeEvent } = vi.hoisted(() => ({
  listNudgeEvents: vi.fn(async (): Promise<ReadonlyArray<NudgeEvent>> => []),
  insertNudgeEvent: vi.fn(async (_db: unknown, _event: NudgeEvent): Promise<void> => undefined),
}));

vi.mock('@goodboy/db', () => ({ listNudgeEvents, insertNudgeEvent }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { recordNextStepOutcome, useNextStepOutcomes } from '.';

const sessionId = 'session-1' as SessionId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useNextStepOutcomes', () => {
  it('turns the loaded events into gate outcomes', async () => {
    listNudgeEvents.mockResolvedValue([
      {
        id: 'ev-1',
        sessionId,
        ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        kind: 'next:push-branch',
        contextJson: null,
        outcome: 'dismissed',
        outcomeTs: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      },
      {
        id: 'ev-2',
        sessionId,
        ts: '2026-01-02T00:00:00.000Z' as IsoDateTime,
        kind: 'scope-mismatch',
        contextJson: null,
        outcome: 'accepted',
        outcomeTs: '2026-01-02T00:00:00.000Z' as IsoDateTime,
      },
    ] satisfies ReadonlyArray<NudgeEvent>);

    const view = renderHook(() => useNextStepOutcomes({ sessionId }));

    await waitFor(() => expect(view.result.current.outcomes).toHaveLength(1));
    expect(view.result.current.outcomes[0]).toEqual({
      kind: 'push-branch',
      outcome: 'dismissed',
      at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('turns a dismissed event carrying a fingerprint into the dismissed set', async () => {
    listNudgeEvents.mockResolvedValue([
      {
        id: 'ev-1',
        sessionId,
        ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        kind: 'next:push-branch',
        contextJson: JSON.stringify({ fingerprint: 'push-branch:mount-web:4' }),
        outcome: 'dismissed',
        outcomeTs: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      },
    ] satisfies ReadonlyArray<NudgeEvent>);

    const view = renderHook(() => useNextStepOutcomes({ sessionId }));

    await waitFor(() =>
      expect(view.result.current.dismissedFingerprints.has('push-branch:mount-web:4')).toBe(true),
    );
  });

  it('drops a fingerprint from the dismissed set once it was later accepted', async () => {
    listNudgeEvents.mockResolvedValue([
      {
        id: 'ev-1',
        sessionId,
        ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        kind: 'next:push-branch',
        contextJson: JSON.stringify({ fingerprint: 'push-branch:mount-web:4' }),
        outcome: 'dismissed',
        outcomeTs: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      },
      {
        id: 'ev-2',
        sessionId,
        ts: '2026-01-02T00:00:00.000Z' as IsoDateTime,
        kind: 'next:push-branch',
        contextJson: JSON.stringify({ fingerprint: 'push-branch:mount-web:4' }),
        outcome: 'accepted',
        outcomeTs: '2026-01-02T00:00:00.000Z' as IsoDateTime,
      },
    ] satisfies ReadonlyArray<NudgeEvent>);

    const view = renderHook(() => useNextStepOutcomes({ sessionId }));

    await waitFor(() => expect(listNudgeEvents).toHaveBeenCalledTimes(1));
    expect(view.result.current.dismissedFingerprints.has('push-branch:mount-web:4')).toBe(false);
  });

  it('fetches every event for the session, no time window', async () => {
    listNudgeEvents.mockResolvedValue([]);
    renderHook(() => useNextStepOutcomes({ sessionId }));

    await waitFor(() => expect(listNudgeEvents).toHaveBeenCalledOnce());
    expect(listNudgeEvents).toHaveBeenCalledWith({
      db: {},
      sessionId,
      sinceTs: new Date(0).toISOString(),
    });
  });

  it('keeps a dismissal in the set past 14 days, it only clears on acceptance', async () => {
    listNudgeEvents.mockResolvedValue([
      {
        id: 'ev-1',
        sessionId,
        ts: '2020-01-01T00:00:00.000Z' as IsoDateTime,
        kind: 'next:push-branch',
        contextJson: JSON.stringify({ fingerprint: 'push-branch:mount-web:4' }),
        outcome: 'dismissed',
        outcomeTs: '2020-01-01T00:00:00.000Z' as IsoDateTime,
      },
    ] satisfies ReadonlyArray<NudgeEvent>);

    const view = renderHook(() => useNextStepOutcomes({ sessionId }));

    await waitFor(() =>
      expect(view.result.current.dismissedFingerprints.has('push-branch:mount-web:4')).toBe(true),
    );
  });

  it('reloads when the session changes', async () => {
    listNudgeEvents.mockResolvedValue([]);
    const view = renderHook(
      ({ id }: { readonly id: SessionId }) => useNextStepOutcomes({ sessionId: id }),
      { initialProps: { id: sessionId } },
    );
    await waitFor(() => expect(listNudgeEvents).toHaveBeenCalledTimes(1));

    view.rerender({ id: 'session-2' as SessionId });

    await waitFor(() => expect(listNudgeEvents).toHaveBeenCalledTimes(2));
  });
});

describe('recordNextStepOutcome', () => {
  it('writes a settled next-step event', async () => {
    await recordNextStepOutcome({ sessionId, kind: 'merge-pr', outcome: 'accepted' });

    expect(insertNudgeEvent).toHaveBeenCalledTimes(1);
    const call = insertNudgeEvent.mock.calls[0];
    const event = call?.[1];
    expect(event).toMatchObject({
      sessionId,
      kind: 'next:merge-pr',
      outcome: 'accepted',
    });
    expect(event?.outcomeTs).not.toBeNull();
  });

  it('carries the fingerprint in contextJson when given one', async () => {
    await recordNextStepOutcome({
      sessionId,
      kind: 'push-branch',
      outcome: 'dismissed',
      fingerprint: 'push-branch:mount-web:4',
    });

    const event = insertNudgeEvent.mock.calls[0]?.[1];
    expect(event?.contextJson).toBe(JSON.stringify({ fingerprint: 'push-branch:mount-web:4' }));
  });

  it('swallows a write failure instead of throwing', async () => {
    insertNudgeEvent.mockRejectedValueOnce(new Error('offline'));
    await expect(
      recordNextStepOutcome({ sessionId, kind: 'push-branch', outcome: 'dismissed' }),
    ).resolves.toBeUndefined();
  });
});
