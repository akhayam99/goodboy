// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
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
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { liveMounts } from '../../../overlap/liveMounts';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../SessionOverviewPane').SessionOverviewPane;

const TENANT = 'hl/tenant-limits';
const SHARED_PATH = 'src/limits/tenant.ts';

type OverlapParams = {
  readonly paths: ReadonlyArray<string>;
};

let overlapAnswer: ReadonlyArray<Readonly<Record<string, unknown>>> = [];

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../SessionOverviewPane'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  liveMounts.reset();
  overlapAnswer = [];
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'overlap_read') {
      return Promise.resolve(overlapAnswer);
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  liveMounts.reset();
});

const tenantMount = () => {
  const mount = (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).find(
    (candidate) => candidate.branch === TENANT,
  );
  if (mount === undefined) {
    throw new Error('The seed must hold the tenant branch');
  }
  return mount;
};

const answerOverlap = ({ paths }: OverlapParams) => {
  const mount = tenantMount();
  overlapAnswer = [
    {
      mountId: mount.mountId,
      sessionId: COLUMN_SESSION_ID,
      projectId: mount.projectId,
      branch: TENANT,
      createdAt: 2,
      port: null,
      hasFixedPort: false,
      paths: [SHARED_PATH, 'src/limits/plan.ts'],
    },
    {
      mountId: 'mount-other-session',
      sessionId: 'session-other',
      projectId: mount.projectId,
      branch: 'ak/eng-1201-tenant-quota',
      createdAt: 1,
      port: null,
      hasFixedPort: false,
      paths,
    },
  ];
};

const show = async () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AutoReleaseContext.Provider value>
          <SessionOverviewPane session={session} />
        </AutoReleaseContext.Provider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await liveMounts.refresh();
  });
};

const tenantTile = (): HTMLElement => {
  const tile = screen
    .getByRole('link', { name: `Open ${TENANT} overview` })
    .closest<HTMLElement>('[data-board-row]');
  if (tile === null) {
    throw new Error('The link must sit in a tile.');
  }
  return tile;
};

describe('the overlap chip on a session branch', () => {
  it('shows on the branch that shares a file with another session', async () => {
    seedCentralColumn({ kind: 'branches' });
    answerOverlap({ paths: [SHARED_PATH] });
    await show();

    within(tenantTile()).getByRole('button', { name: /^Overlaps/ });
  });

  it('stays away while the branches change different files', async () => {
    seedCentralColumn({ kind: 'branches' });
    answerOverlap({ paths: ['src/other.ts'] });
    await show();

    expect(within(tenantTile()).queryByRole('button', { name: /^Overlaps/ })).toBeNull();
  });
});
