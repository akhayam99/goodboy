// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  harborline,
  ledgerCore,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { useStageGroupedSessions, useWorkspaceAttention } from './selectors';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const quiet = sessionOf({ goal: 'Quiet one' });
const inPayments = sessionOf({ goal: 'Question in payments-api' });
const inLedger = sessionOf({ goal: 'Question in ledger-core' });
const withReply = sessionOf({ goal: 'Reply to read in ledger-core' });

const seed = () => {
  seedColumn({
    store: useAppStore,
    sessions: [quiet, inPayments, inLedger, withReply],
    questions: [inPayments, inLedger],
    mounts: [
      [quiet, paymentsApi],
      [inPayments, paymentsApi],
      [inLedger, ledgerCore],
      [withReply, ledgerCore],
    ],
  });
  useAppStore.setState({
    sessionPhaseRuns: {
      [withReply.id]: [
        anAgent({
          id: brandId<AgentId>({ value: 'agent-reply' }),
          sessionId: withReply.id,
          status: 'completed',
          lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-06T09:00:00.000Z' }),
        }),
      ],
    },
  });
};

const filterTo = (projectId: typeof paymentsApi.id) => {
  act(() => {
    useAppStore.getState().setSelectedProjectIds({
      workspaceId: harborline.id,
      selectedProjectIds: [projectId],
    });
  });
};

const render = () =>
  renderHook(() => {
    const sessions = useAppStore((state) => state.sessions);
    return {
      attention: useWorkspaceAttention({ workspaceId: harborline.id, sessions }),
      groups: useStageGroupedSessions(harborline.id, sessions),
    };
  });

const laneOf = (groups: ReturnType<typeof render>['result']['current']['groups']) =>
  groups.find((group) => group.key === 'attention')?.sessions ?? [];

describe('the count of sessions that need you', () => {
  it('counts a question as needing you and a reply to read as a quiet one', () => {
    seed();
    const { result } = render();

    expect(result.current.attention).toMatchObject({
      count: 2,
      quietCount: 1,
      tone: 'warning',
      reasons: ['1 question for you'],
      quietReasons: ['New reply'],
    });
  });

  it('equals the Needs you lane header when everything in the lane is loud', () => {
    seed();
    useAppStore.setState({ sessionPhaseRuns: {} });
    const { result } = render();

    expect(result.current.attention.count).toBe(laneOf(result.current.groups).length);
  });

  it('differs from the lane header by exactly the quiet sessions', () => {
    seed();
    const { result } = render();

    expect(laneOf(result.current.groups)).toHaveLength(
      result.current.attention.count + result.current.attention.quietCount,
    );
  });

  it('keeps a session in another project counted under a project filter', () => {
    seed();
    filterTo(paymentsApi.id);
    const { result } = render();

    expect(laneOf(result.current.groups).map((session) => session.goal)).toEqual([
      'Question in payments-api',
    ]);
    expect(result.current.attention.count).toBe(2);
  });

  it('counts again once the filter is gone, with the same figure', () => {
    seed();
    filterTo(paymentsApi.id);
    const { result } = render();
    const filtered = result.current.attention.count;
    act(() => {
      useAppStore.getState().setSelectedProjectIds({
        workspaceId: harborline.id,
        selectedProjectIds: [],
      });
    });

    expect(result.current.attention.count).toBe(filtered);
  });

  it('drops a session from the count once its question is answered', () => {
    seed();
    const { result } = render();
    act(() => {
      useAppStore.setState({ sessionOpenQuestions: {} });
    });

    expect(result.current.attention.count).toBe(0);
    expect(result.current.attention.tone).toBeNull();
  });
});
