// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { BulkSessionResult } from '../../../store/slices/sessions/types';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../auto/autoReleaseContext';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../components/SessionOverviewPane').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../components/SessionOverviewPane'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
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

const mountedSession = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

type MergeParams = {
  readonly state: 'merged' | 'closed' | 'open';
};

const setRequestState = ({ state }: MergeParams) => {
  act(() => {
    useAppStore.setState((store) => {
      const mountEntries = Object.entries(store.mountGithub);
      return {
        sessionGithub: Object.fromEntries(
          Object.entries(store.sessionGithub).map(([id, github]) => [
            id,
            github.pr === null ? github : { ...github, pr: { ...github.pr, state } },
          ]),
        ),
        mountGithub: Object.fromEntries(
          mountEntries.map(([id, github]) => [
            id,
            {
              ...github,
              pr: github.pr === null ? null : { ...github.pr, state },
              prs: github.prs.map((pr) => ({ ...pr, state })),
            },
          ]),
        ),
      };
    });
  });
};

const show = async () => {
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={mountedSession()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
};

describe('the Archive this session offer in Next', () => {
  it('is not offered while the pull request is open', async () => {
    seedCentralColumn({ kind: 'finished' });
    await show();

    expect(screen.queryByText('Archive this session')).toBeNull();
  });

  it('is offered once every branch is merged, with the reason and one Archive button', async () => {
    seedCentralColumn({ kind: 'finished' });
    setRequestState({ state: 'merged' });
    await show();

    const next = screen.getByRole('region', { name: 'Next' });
    within(next).getByText('Archive this session');
    expect(next.textContent).toContain('All branches merged');
    within(next).getByRole('button', { name: /^Archive/ });
  });

  it('archives on one click and offers Undo in the toast', async () => {
    seedCentralColumn({ kind: 'finished' });
    setRequestState({ state: 'closed' });
    const bulkArchiveTask = vi.fn(
      async (ids: ReadonlyArray<SessionId>): Promise<BulkSessionResult> => ({
        succeeded: [...ids],
        failed: [],
      }),
    );
    act(() => {
      useAppStore.setState({ bulkArchiveTask });
    });
    await show();

    const next = screen.getByRole('region', { name: 'Next' });
    expect(next.textContent).toContain('All branches closed');
    await act(async () => {
      fireEvent.click(within(next).getByRole('button', { name: /^Archive/ }));
      await Promise.resolve();
    });
    await settle();

    expect(bulkArchiveTask).toHaveBeenCalledWith([COLUMN_SESSION_ID]);
    screen.getByText('Session archived');
    screen.getByRole('button', { name: 'Undo' });
  });
});
