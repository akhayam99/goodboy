// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId } from '@goodboy/types';
import {
  aProject,
  aSession,
  nextProjectId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  release: (): void => undefined,
  readRebasePlan: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/history/historyEngine', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readRebasePlan: h.readRebasePlan,
  predictHistoryPlan: vi.fn(async () => null),
  tryHistoryPlan: vi.fn(async () => ({ stop: null, head: null, map: [] })),
}));

import { resetWorktreeStatusCache } from '../worktreeStatuses/cache';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const WORKSPACE_ID = nextWorkspaceId();
const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-rebase'));

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.clearAllMocks();
  await resetStoryStore();
  resetWorktreeStatusCache();
  store.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'ledger-core' })],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: '/w/ledger',
          lastWorktreePath: null,
          repoRoot: '/repos/ledger-core',
          branch: 'fix/ledger-postings',
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
  });
  h.readRebasePlan.mockReturnValue(new Promise(() => undefined));
});

describe('rebaseBranch', () => {
  it('runs once for two clicks that race the clean tree check', async () => {
    const gate = new Promise<void>((resolve) => {
      h.release = resolve;
    });
    stubStoryInvoke({
      worktree_status: async () => {
        await gate;
        return {
          branch: 'fix/ledger-postings',
          head: 'head-sha',
          headSubject: null,
          upstream: null,
          upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
          mainDistance: { kind: 'known', ahead: 0, behind: 0 },
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 0,
            untracked: 0,
            unmerged: 0,
            changed: 0,
          },
        };
      },
    });

    void store
      .getState()
      .rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID, ontoBranch: undefined });
    const second = store
      .getState()
      .rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID, ontoBranch: undefined });
    h.release();

    expect(await second).toBe('busy');
    expect(h.readRebasePlan).toHaveBeenCalledTimes(1);
  });
});
