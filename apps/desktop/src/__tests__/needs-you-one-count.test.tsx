// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../store/storyHarness')).dbModuleMock());
vi.mock('../shared/lib/db', async () => (await import('../store/storyHarness')).dbLibModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../store/storyHarness';
import {
  harborline,
  ledgerCore,
  paymentsApi,
  runningState,
  seedColumn,
  sessionOf,
} from '../features/workspace/testing/sessionColumn';
import { useDoorSignals } from '../app/components/SideColumn/useDoorSignals';
import { useNeedsYouElsewhere } from '../features/workspace/components/StageBoard/useNeedsYouElsewhere';
import { useNowSessions } from '../shared/hooks/useNowSessions';
import { useSessionOrder } from '../store/slices/session-view/selectors';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const inPayments = sessionOf({ goal: 'Question in payments-api' });
const inLedger = sessionOf({ goal: 'Question in ledger-core' });
const pinnedAsk = sessionOf({ goal: 'Pinned question' });
const unreadReply = sessionOf({ goal: 'Reply nobody read yet' });
const running = sessionOf({ goal: 'Still going', state: runningState() });

const finishedUnread = anAgent({
  sessionId: unreadReply.id,
  kind: 'implementer',
  status: 'completed',
  lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-06T10:00:00.000Z' }),
});

const seed = () => {
  seedColumn({
    store: useAppStore,
    sessions: [inPayments, inLedger, pinnedAsk, unreadReply, running],
    questions: [inPayments, inLedger, pinnedAsk],
    mounts: [
      [inPayments, paymentsApi],
      [inLedger, ledgerCore],
      [pinnedAsk, ledgerCore],
      [unreadReply, paymentsApi],
      [running, paymentsApi],
    ],
  });
  useAppStore.setState({
    sessionPhaseRuns: { [unreadReply.id]: [finishedUnread] },
    sessionPins: { [harborline.id]: [{ id: pinnedAsk.id, at: 1 }] },
  });
  useAppStore.getState().setSelectedProjectIds({
    workspaceId: harborline.id,
    selectedProjectIds: [paymentsApi.id],
  });
};

const useOrder = () =>
  useSessionOrder({
    workspaceId: harborline.id,
    sessions: useAppStore((state) => state.sessions),
  });

const useSurfaces = () => {
  const sessions = useAppStore((state) => state.sessions);
  const door = useDoorSignals({});
  const lane = useNeedsYouElsewhere({ workspaceId: harborline.id, sessions });
  const order = useOrder();
  const now = useNowSessions({});
  return {
    rail: door.board?.count ?? 0,
    lane: lane.count,
    popover: order.groups.find((group) => group.key === 'attention')?.count ?? 0,
    nowChip: now.needsYou.length,
  };
};

describe('one needs you number for the whole workspace', () => {
  it('reads the same on the rail, the lane, the popover and the Now chip, filter on', () => {
    seed();
    const { result } = renderHook(useSurfaces);

    expect(result.current).toEqual({ rail: 3, lane: 3, popover: 3, nowChip: 3 });
  });

  it('moves on every surface at once when a question is answered', () => {
    seed();
    const { result } = renderHook(useSurfaces);
    act(() => {
      useAppStore.setState({
        sessionOpenQuestions: Object.fromEntries(
          Object.entries(useAppStore.getState().sessionOpenQuestions).filter(
            ([id]) => id !== inLedger.id,
          ),
        ),
      });
    });

    expect(result.current).toEqual({ rail: 2, lane: 2, popover: 2, nowChip: 2 });
  });

  it('lists a quiet reason under Needs you without counting it', () => {
    seed();
    const { result } = renderHook(useOrder);
    const attention = result.current.groups.find((group) => group.key === 'attention');

    expect(attention?.sessions.map((session) => session.goal)).toContain(unreadReply.goal);
    expect(attention?.count).toBe(3);
  });

  it('orders Pinned, then needs you, then running, the project filter left aside', () => {
    seed();
    const { result } = renderHook(useOrder);

    expect(result.current.groups.map((group) => group.key)).toEqual([
      'pinned',
      'attention',
      'running',
    ]);
    expect(result.current.order[0]).toBe(pinnedAsk.id);
    expect(result.current.order).toContain(inLedger.id);
  });
});
