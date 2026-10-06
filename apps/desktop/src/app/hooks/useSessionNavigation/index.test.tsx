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
import { cleanup, renderHook } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import {
  harborline,
  mergedGithub,
  runningState,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { useSessionNavigation } from '.';

let useAppStore: StoryStore;
const navigate = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  navigate.mockClear();
});

afterEach(cleanup);

const opened = (hour: number, goal: string): Session =>
  sessionOf({
    goal,
    lastOpenedAt: `2026-10-06T${String(hour).padStart(2, '0')}:00:00.000Z`,
  });

const idOf = (session: Session) => session.id as SessionId;

const mount = ({
  sessions,
  current,
  questions = [],
}: {
  readonly sessions: ReadonlyArray<Session>;
  readonly current: Session | null;
  readonly questions?: ReadonlyArray<Session>;
}) => {
  seedColumn({
    store: useAppStore,
    sessions,
    currentSessionId: current === null ? null : idOf(current),
    questions,
  });
  useAppStore.setState({ navigate });
  return renderHook(() => useSessionNavigation());
};

const lastTarget = () => navigate.mock.calls.at(-1)?.[0];

describe('stepping from session to session', () => {
  const first = opened(12, 'Opened last');
  const second = opened(11, 'Opened before');
  const third = opened(10, 'Opened first');
  const waiting = sessionOf({ goal: 'Waits on you', updatedAt: '2026-10-01T09:00:00.000Z' });

  it('follows the order of the list, needs you first', () => {
    const { result } = mount({
      sessions: [first, second, third, waiting],
      current: waiting,
      questions: [waiting],
    });
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual({ to: sessionPlace({ sessionId: idOf(first) }) });
  });

  it('goes back to the previous row', () => {
    const { result } = mount({ sessions: [first, second, third], current: second });
    result.current({ delta: -1 });
    expect(lastTarget()).toEqual({ to: sessionPlace({ sessionId: idOf(first) }) });
  });

  it('stays put at the end of the list', () => {
    const { result } = mount({ sessions: [first, second, third], current: third });
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the first or last row when none is open', () => {
    const { result } = mount({ sessions: [first, second, third], current: null });
    result.current({ delta: 1 });
    result.current({ delta: -1 });
    expect(navigate).toHaveBeenNthCalledWith(1, { to: sessionPlace({ sessionId: idOf(first) }) });
    expect(navigate).toHaveBeenNthCalledWith(2, { to: sessionPlace({ sessionId: idOf(third) }) });
  });

  it('does nothing without sessions', () => {
    const { result } = mount({ sessions: [], current: null });
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('the rows the list folds', () => {
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

  it('never steps into a row the fold hides', () => {
    const { result } = mount({ sessions: twelve, current: twelve[7] ?? null });
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('walks every row once the fold is open', () => {
    seedColumn({
      store: useAppStore,
      sessions: twelve,
      currentSessionId: idOf(twelveAt(7)),
    });
    useAppStore
      .getState()
      .setSessionViewPrefs({ workspaceId: harborline.id, patch: { isFoldOpen: true } });
    useAppStore.setState({ navigate });
    const { result } = renderHook(() => useSessionNavigation());
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual({ to: sessionPlace({ sessionId: idOf(twelveAt(8)) }) });
  });

  it('keeps the open session in reach even when it sits below the fold', () => {
    const { result } = mount({ sessions: twelve, current: twelve[10] ?? null });
    result.current({ delta: -1 });
    expect(lastTarget()).toEqual({ to: sessionPlace({ sessionId: idOf(twelveAt(7)) }) });
  });
});

describe('a grouped list', () => {
  const running = sessionOf({
    goal: 'Still going',
    state: runningState(),
    lastOpenedAt: '2026-10-06T12:00:00.000Z',
  });
  const merged = opened(11, 'Merged long ago');
  const idle = opened(10, 'Quiet');

  const mountGrouped = (isDoneExpanded: boolean) => {
    seedColumn({
      store: useAppStore,
      sessions: [running, merged, idle],
      currentSessionId: idOf(idle),
    });
    useAppStore.setState({
      navigate,
      sessionGithub: { [merged.id]: mergedGithub() },
      sessionGroupExpanded: isDoneExpanded ? { done: true } : {},
    });
    useAppStore
      .getState()
      .setSessionViewPrefs({ workspaceId: harborline.id, patch: { group: 'stage' } });
    return renderHook(() => useSessionNavigation());
  };

  it('skips a group the list collapses by default', () => {
    const { result } = mountGrouped(false);
    result.current({ delta: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('walks into the group once the list expands it', () => {
    const { result } = mountGrouped(true);
    result.current({ delta: 1 });
    expect(lastTarget()).toEqual({ to: sessionPlace({ sessionId: idOf(merged) }) });
  });

  it('walks the groups in the order of the list, needs you and running first', () => {
    const { result } = mountGrouped(true);
    result.current({ delta: -1 });
    expect(lastTarget()).toEqual({ to: sessionPlace({ sessionId: idOf(running) }) });
  });
});
