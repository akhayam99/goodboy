// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../actions/components/ObjectMenuProvider';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let DeskProjects: typeof import('.').DeskProjects;
let useOverviewModel: typeof import('../../SessionOverviewPane/useOverviewModel').useOverviewModel;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ DeskProjects } = await import('.'));
  ({ useOverviewModel } = await import('../../SessionOverviewPane/useOverviewModel'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

type StateParams = {
  readonly state: 'merged' | 'closed';
};

const setRequestState = ({ state }: StateParams) => {
  act(() => {
    useAppStore.setState((store) => ({
      sessionGithub: Object.fromEntries(
        Object.entries(store.sessionGithub).map(([id, github]) => [
          id,
          github.pr === null ? github : { ...github, pr: { ...github.pr, state } },
        ]),
      ),
      mountGithub: Object.fromEntries(
        Object.entries(store.mountGithub).map(([id, github]) => [
          id,
          {
            ...github,
            pr: github.pr === null ? null : { ...github.pr, state },
            prs: github.prs.map((pr) => ({ ...pr, state })),
          },
        ]),
      ),
    }));
  });
};

const showDesk = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  const { result } = renderHook(() => useOverviewModel({ session }), {
    wrapper: ({ children }) => (
      <ToastProvider>
        <ObjectMenuProvider>{children}</ObjectMenuProvider>
      </ToastProvider>
    ),
  });
  render(<DeskProjects sessionId={session.id} board={result.current.board} />);
};

const projectNames = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-desk-project]')].map(
    (row) => row.getAttribute('aria-label') ?? '',
  );

describe('the projects of the Desk', () => {
  it.each([
    ['merged', 'Merged', 'Closed'],
    ['closed', 'Closed', 'Merged'],
  ] as const)('names a %s request on the row and in its name', (state, word, other) => {
    seedCentralColumn({ kind: 'branches' });
    setRequestState({ state });
    showDesk();

    expect(projectNames().some((name) => name.endsWith(`, ${word}`))).toBe(true);
    expect(projectNames().some((name) => name.endsWith(`, ${other}`))).toBe(false);
    expect(screen.getAllByText(word).length).toBeGreaterThan(0);
  });
});
