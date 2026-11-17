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
import { LOG_PAGE_ROWS } from '../../central/log/logPageOf';
import {
  BIG_SESSION_ID,
  seedBigSession,
} from '../../../../app/components/MockScene/scenes/u47/bigSessionSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let CentralColumn: typeof import('./CentralColumn').CentralColumn;

const FIRST_PAINT_BUDGET_MS = 300;
const LONG_TASK_BUDGET_MS = 100;

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

const settle = async () => {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('the overview of a session with 171 agents', () => {
  it('paints its first frame inside the budget', async () => {
    seedBigSession();
    const session = useAppStore.getState().sessions.find((item) => item.id === BIG_SESSION_ID);
    if (session === undefined) {
      throw new Error('The seed must hold the session');
    }
    let commits = 0;
    let firstCommitMs = 0;
    let longestCommitMs = 0;
    const startedAt = performance.now();
    await act(async () => {
      render(
        <ToastProvider>
          <AutoReleaseContext.Provider value>
            <Profiler
              id="overview"
              onRender={(_id, _phase, actualMs) => {
                commits += 1;
                longestCommitMs = Math.max(longestCommitMs, actualMs);
                if (commits === 1) {
                  firstCommitMs = actualMs;
                }
              }}
            >
              <CentralColumn session={session} />
            </Profiler>
          </AutoReleaseContext.Provider>
        </ToastProvider>,
      );
    });
    const mountMs = performance.now() - startedAt;
    await settle();
    const rows = document.querySelectorAll('[data-log-row]').length;
    process.stdout.write(
      `[perf] big session overview mount ${mountMs.toFixed(0)}ms, first commit ${firstCommitMs.toFixed(0)}ms, longest commit ${longestCommitMs.toFixed(0)}ms, ${commits} commits, ${rows} log rows\n`,
    );
    expect(firstCommitMs).toBeLessThan(FIRST_PAINT_BUDGET_MS);
    expect(longestCommitMs).toBeLessThan(LONG_TASK_BUDGET_MS);
    expect(rows).toBeLessThanOrEqual(LOG_PAGE_ROWS);
  });
});
