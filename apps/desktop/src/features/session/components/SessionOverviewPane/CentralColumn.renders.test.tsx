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
import { brandId, type MountId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { aMountGithub } from '../../../../store/slices/github/testing/aMountGithub';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
  type ColumnKind,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let CentralColumn: typeof import('./CentralColumn').CentralColumn;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ CentralColumn } = await import('./CentralColumn'));
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const STRANGER_MOUNT = brandId<MountId>({ value: 'mount-of-another-session' });

const settle = async () => {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

type ShowParams = {
  readonly kind: ColumnKind;
};

const showColumn = async ({ kind }: ShowParams) => {
  seedCentralColumn({ kind });
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  let commits = 0;
  const onLeadChange = vi.fn();
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <Profiler
          id="overview"
          onRender={() => {
            commits += 1;
          }}
        >
          <CentralColumn session={session} onLeadChange={onLeadChange} />
        </Profiler>
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
  return { commitsSince: () => commits };
};

describe('the central column does not render for what is not its own', () => {
  it('stays still when a pull request of a mount of another session is written', async () => {
    const column = await showColumn({ kind: 'mid' });
    const before = column.commitsSince();

    await act(async () => {
      useAppStore.setState((state) => ({
        mountGithub: {
          ...state.mountGithub,
          [STRANGER_MOUNT]: aMountGithub({ mountId: STRANGER_MOUNT }),
        },
      }));
    });
    await settle();

    expect(column.commitsSince()).toBe(before);
  });

  it('stays still across clock ticks when no Auto agent can change the output', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const column = await showColumn({ kind: 'finished' });
    expect(useAppStore.getState().autoTreeViews[COLUMN_SESSION_ID] ?? []).toHaveLength(0);
    const before = column.commitsSince();

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    await settle();

    expect(column.commitsSince()).toBe(before);
  });
});
