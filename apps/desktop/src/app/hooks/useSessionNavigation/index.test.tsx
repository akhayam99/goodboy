// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { Session } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import {
  harborline,
  ledgerCore,
  mergedGithub,
  paymentsApi,
  runningState,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { useSessionNavigation } from '.';

let useAppStore: StoryStore;
type Navigate = ReturnType<StoryStore['getState']>['navigate'];
const navigate = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers({ now: Date.parse('2026-10-06T23:00:00.000Z'), toFake: ['Date'] });
  await resetStoryStore();
  localStorage.clear();
  navigate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const opened = (hour: number, goal: string): Session =>
  sessionOf({
    goal,
    updatedAt: `2026-10-06T${String(hour).padStart(2, '0')}:00:00.000Z`,
  });

const idOf = (session: Session) => session.id;

type MountParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly current: Session | null;
  readonly questions?: ReadonlyArray<Session>;
  readonly pinned?: ReadonlyArray<Session>;
  readonly mounts?: ReadonlyArray<readonly [Session, typeof paymentsApi]>;
};

const mount = ({ sessions, current, questions = [], pinned = [], mounts = [] }: MountParams) => {
  seedColumn({
    store: useAppStore,
    sessions,
    currentSessionId: current === null ? null : idOf(current),
    questions,
    mounts,
  });
  useAppStore.setState({
    navigate,
    sessionPins: {
      [harborline.id]: pinned.map((session, index) => ({ id: idOf(session), at: index + 1 })),
    },
  });
  return renderHook(() => useSessionNavigation());
};

const lastTarget = () => navigate.mock.calls.at(-1)?.[0];

const placeOf = (session: Session) => ({ to: sessionPlace({ sessionId: idOf(session) }) });

describe('stepping from session to session', () => {
  const first = opened(12, 'Opened last');
  const second = opened(11, 'Opened before');
  const third = opened(10, 'Opened first');
  const waiting = sessionOf({ goal: 'Waits on you', updatedAt: '2026-10-01T09:00:00.000Z' });

  it('puts the sessions that need you first', () => {
    const { result } = mount({
      sessions: [first, second, third, waiting],
      current: waiting,
      questions: [waiting],
    });
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual(placeOf(first));
  });

  it('goes back to the previous session', () => {
    const { result } = mount({ sessions: [first, second, third], current: second });
    result.current({ delta: -1 });
    expect(lastTarget()).toEqual(placeOf(first));
  });

  it('stays put at the end of the order', () => {
    const { result } = mount({ sessions: [first, second, third], current: third });
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the first or last session when none is open', () => {
    const { result } = mount({ sessions: [first, second, third], current: null });
    result.current({ delta: 1 });
    result.current({ delta: -1 });
    expect(navigate).toHaveBeenNthCalledWith(1, placeOf(first));
    expect(navigate).toHaveBeenNthCalledWith(2, placeOf(third));
  });

  it('does nothing without sessions', () => {
    const { result } = mount({ sessions: [], current: null });
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('walking while opening each session', () => {
  const first = opened(20, 'A');
  const rows = [first, opened(19, 'B'), opened(18, 'C'), opened(17, 'D'), opened(16, 'E')];

  it('visits four different sessions in four presses', () => {
    seedColumn({ store: useAppStore, sessions: rows, currentSessionId: first.id });
    const visited: string[] = [];
    const navigateAndOpen: Navigate = ({ to }) => {
      if (to.at !== 'session') {
        return;
      }
      visited.push(rows.find((row) => row.id === to.sessionId)?.goal ?? '');
      useAppStore.getState().markSessionOpened({ sessionId: to.sessionId });
      useAppStore.setState({ currentSessionId: to.sessionId });
    };
    useAppStore.setState({ navigate: navigateAndOpen });
    const { result, rerender } = renderHook(() => useSessionNavigation());
    for (let press = 0; press < 4; press += 1) {
      act(() => result.current({ delta: 1 }));
      rerender();
    }
    expect(visited).toEqual(['B', 'C', 'D', 'E']);
  });
});

describe('an order that lives in the data, not in a drawn list', () => {
  const twelve = Array.from({ length: 12 }, (_, index) =>
    opened(23 - index, `Session ${index + 1}`),
  );
  const twelveAt = (index: number): Session => {
    const found = twelve[index];
    if (found === undefined) {
      throw new Error(`no session at ${index}`);
    }
    return found;
  };

  it('walks past the eighth session, with no fold', () => {
    const { result } = mount({ sessions: twelve, current: twelveAt(7) });
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual(placeOf(twelveAt(8)));
  });

  it('keeps the same order whatever the Board sort says', () => {
    const { result } = mount({ sessions: twelve, current: twelveAt(0) });
    useAppStore
      .getState()
      .setSessionViewPrefs({ workspaceId: harborline.id, patch: { sort: 'goal', group: 'pr' } });
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual(placeOf(twelveAt(1)));
  });

  it('walks the sessions the project filter hides', () => {
    const inPayments = opened(12, 'In payments-api');
    const inLedger = opened(11, 'In ledger-core');
    const { result } = mount({
      sessions: [inPayments, inLedger],
      current: inPayments,
      mounts: [
        [inPayments, paymentsApi],
        [inLedger, ledgerCore],
      ],
    });
    act(() => {
      useAppStore.getState().setSelectedProjectIds({
        workspaceId: harborline.id,
        selectedProjectIds: [paymentsApi.id],
      });
    });
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual(placeOf(inLedger));
  });
});

describe('the order by state', () => {
  const running = sessionOf({
    goal: 'Still going',
    state: runningState(),
    updatedAt: '2026-10-06T08:00:00.000Z',
  });
  const merged = opened(12, 'Merged long ago');
  const idle = opened(10, 'Quiet');
  const waiting = sessionOf({ goal: 'Waits on you', updatedAt: '2026-10-01T09:00:00.000Z' });

  const mountStates = ({
    current,
    pinned = [],
  }: {
    readonly current: Session;
    readonly pinned?: ReadonlyArray<Session>;
  }) => {
    const rendered = mount({
      sessions: [idle, merged, running, waiting],
      current,
      questions: [waiting],
      pinned,
    });
    act(() => {
      useAppStore.setState({ sessionGithub: { [merged.id]: mergedGithub() } });
    });
    rendered.rerender();
    return rendered;
  };

  it('walks needs you, then running, then the rest', () => {
    const { result } = mountStates({ current: waiting });
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual(placeOf(running));
  });

  it('leaves a done session out of the walk', () => {
    const { result } = mountStates({ current: idle });
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('puts the pinned sessions first, in pin order, done ones included', () => {
    const { result } = mountStates({ current: idle, pinned: [merged, idle] });
    result.current({ delta: -1 });
    expect(lastTarget()).toEqual(placeOf(merged));
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual(placeOf(waiting));
  });
});
