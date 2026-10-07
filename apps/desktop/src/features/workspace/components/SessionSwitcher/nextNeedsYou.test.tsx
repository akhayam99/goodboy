// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { aWorkflowRun } from '@goodboy/types/testing';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import {
  ledgerCore,
  paymentsApi,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';
import { nextNeedsYou } from './nextNeedsYou';
import { SessionSwitcher } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const quiet = sessionOf({ goal: 'Quiet one', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const waitedLong = sessionOf({ goal: 'Waited long', updatedAt: '2026-10-01T09:00:00.000Z' });
const waitedShort = sessionOf({ goal: 'Waited short', updatedAt: '2026-10-05T09:00:00.000Z' });
const idOf = (session: { readonly id: string }) => session.id as SessionId;

const seed = (currentSessionId: SessionId | null) =>
  seedColumn({
    store: useAppStore,
    sessions: [quiet, waitedShort, waitedLong],
    currentSessionId,
    questions: [waitedShort, waitedLong],
    mounts: [
      [quiet, paymentsApi],
      [waitedShort, paymentsApi],
      [waitedLong, ledgerCore],
    ],
  });

describe('the next session that needs you', () => {
  it('is none when nothing needs you', () => {
    seedColumn({ store: useAppStore, sessions: [quiet], currentSessionId: idOf(quiet) });
    expect(nextNeedsYou({ state: useAppStore.getState() })).toBeNull();
  });

  it('starts with the oldest wait when the open session is calm', () => {
    seed(idOf(quiet));
    expect(nextNeedsYou({ state: useAppStore.getState() })).toEqual({
      sessionId: idOf(waitedLong),
      reason: 'open-question',
    });
  });

  it('goes to the next one after the open session and wraps around', () => {
    seed(idOf(waitedLong));
    expect(nextNeedsYou({ state: useAppStore.getState() })?.sessionId).toBe(idOf(waitedShort));
    seed(idOf(waitedShort));
    expect(nextNeedsYou({ state: useAppStore.getState() })?.sessionId).toBe(idOf(waitedLong));
  });

  it('follows the project filter of the list', () => {
    seed(idOf(quiet));
    act(() => {
      useAppStore.getState().setSelectedProjectIds({
        workspaceId: quiet.workspaceId,
        selectedProjectIds: [paymentsApi.id],
      });
    });
    expect(nextNeedsYou({ state: useAppStore.getState() })?.sessionId).toBe(idOf(waitedShort));
  });
});

describe('the key for the next session that needs you', () => {
  const press = () => {
    act(() => {
      pressShortcut({ id: 'session.nextNeedsYou', target: document.body });
    });
  };

  it('lands on the page that holds what is waiting', () => {
    seed(idOf(quiet));
    render(<SessionSwitcher />);
    press();
    expect(useAppStore.getState().currentSessionId).toBe(idOf(waitedLong));
    expect(useAppStore.getState().activeLens[waitedLong.id]).toBe('questions');
  });

  it('moves on to the next session at each press', () => {
    seed(idOf(quiet));
    render(<SessionSwitcher />);
    press();
    press();
    expect(useAppStore.getState().currentSessionId).toBe(idOf(waitedShort));
  });

  it('does nothing when no session needs you', () => {
    seedColumn({ store: useAppStore, sessions: [quiet], currentSessionId: idOf(quiet) });
    render(<SessionSwitcher />);
    press();
    expect(useAppStore.getState().currentSessionId).toBe(idOf(quiet));
  });
});

describe('sessions that wait on you while work goes on', () => {
  const runningAsking = sessionOf({
    goal: 'Running and asking',
    state: runningState(),
    updatedAt: '2026-10-02T09:00:00.000Z',
  });
  const planHeld = {
    ...sessionOf({ goal: 'Plan held', updatedAt: '2026-10-03T09:00:00.000Z' }),
    workflowRuns: [
      aWorkflowRun({
        id: 'run-plan-held' as WorkflowRunId,
        orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      }),
    ],
  };
  const runningQuiet = sessionOf({
    goal: 'Running and quiet',
    state: runningState(),
    updatedAt: '2026-10-01T09:00:00.000Z',
  });

  const seedWork = (currentSessionId: SessionId | null) =>
    seedColumn({
      store: useAppStore,
      sessions: [quiet, runningAsking, planHeld, runningQuiet],
      currentSessionId,
      questions: [runningAsking],
    });

  it('reaches a running session that has a question', () => {
    seedWork(idOf(quiet));
    expect(nextNeedsYou({ state: useAppStore.getState() })).toEqual({
      sessionId: idOf(runningAsking),
      reason: 'open-question',
    });
  });

  it('reaches a session whose plan waits for approval, then wraps back', () => {
    seedWork(idOf(runningAsking));
    expect(nextNeedsYou({ state: useAppStore.getState() })).toEqual({
      sessionId: idOf(planHeld),
      reason: 'plan-approval',
    });
    seedWork(idOf(planHeld));
    expect(nextNeedsYou({ state: useAppStore.getState() })?.sessionId).toBe(idOf(runningAsking));
  });

  it('skips a running session with nothing waiting on you', () => {
    const reached = new Set<SessionId>();
    for (const from of [quiet, runningAsking, planHeld]) {
      seedWork(idOf(from));
      const next = nextNeedsYou({ state: useAppStore.getState() })?.sessionId;
      if (next !== undefined) {
        reached.add(next);
      }
    }
    expect(reached.has(idOf(runningQuiet))).toBe(false);
    expect(reached.size).toBe(2);
  });

  it('lands the key on the run page of the held plan', () => {
    seedWork(idOf(runningAsking));
    render(<SessionSwitcher />);
    act(() => {
      pressShortcut({ id: 'session.nextNeedsYou', target: document.body });
    });
    const state = useAppStore.getState();
    expect(state.currentSessionId).toBe(idOf(planHeld));
    expect(state.activeLens[planHeld.id]).toBe('workflows');
    expect(state.focusedWorkflowRunId[planHeld.id]).toBe('run-plan-held');
  });
});
