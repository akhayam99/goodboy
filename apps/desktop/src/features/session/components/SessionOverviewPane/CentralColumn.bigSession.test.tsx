// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { Profiler } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import {
  BIG_SESSION_ID,
  seedBigSession,
} from '../../../../app/components/MockScene/scenes/u47/bigSessionSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let CentralColumn: typeof import('./CentralColumn').CentralColumn;

const OPEN_COMMIT_BUDGET = 6;
const OPEN_IPC_BUDGET = 30;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ CentralColumn } = await import('./CentralColumn'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

const RECENT_ROWS = 3;

const settle = async () => {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('the overview of a session with 171 agents', () => {
  it('defers the log and bounds the work when opened', async () => {
    seedBigSession();
    const session = useAppStore.getState().sessions.find((item) => item.id === BIG_SESSION_ID);
    if (session === undefined) {
      throw new Error('The seed must hold the session');
    }
    let commits = 0;
    let firstFrameRows = -1;
    storySpies.tauriInvoke.mockClear();
    await act(async () => {
      render(
        <ToastProvider>
          <AutoReleaseContext.Provider value>
            <Profiler
              id="overview"
              onRender={() => {
                commits += 1;
                if (commits === 1) {
                  firstFrameRows = document.querySelectorAll('[data-log-row]').length;
                }
              }}
            >
              <CentralColumn session={session} />
            </Profiler>
          </AutoReleaseContext.Provider>
        </ToastProvider>,
      );
    });
    await settle();
    const rows = document.querySelectorAll('[data-log-row]').length;
    expect(firstFrameRows).toBe(0);
    expect(commits).toBeLessThanOrEqual(OPEN_COMMIT_BUDGET);
    expect(rows).toBe(RECENT_ROWS);
    expect(storySpies.tauriInvoke.mock.calls.length).toBeLessThanOrEqual(OPEN_IPC_BUDGET);
  });
});
