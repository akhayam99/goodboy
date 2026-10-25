import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionProjectMount } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
} from '../../../features/history/testing/aRebaseRun';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../storyHarness';
import { resetWorktreeStatusCache } from '../../runtime/worktreeStatuses/cache';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    getDraftHistoryPlan: vi.fn(async () => null),
  }),
);

const project = aProject({ name: 'payments-api', baseBranch: 'main' });
const mount: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: project.id,
  mountName: 'payments-api',
  worktreePath: '/w/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'hl/ledger-export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};
const input = { sessionId: A_REBASE_SESSION_ID, mountId: A_REBASE_MOUNT_ID };
const plans: unknown[] = [];
let store: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  plans.length = 0;
  store.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [project],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [mount] },
  });
  stubStoryInvoke({
    worktree_status: () => ({
      branch: mount.branch,
      head: 'old-head',
      headSubject: 'Acme export',
      upstream: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      mainDistance: { kind: 'known', ahead: 7, behind: 4 },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
      inProgress: null,
    }),
    history_remote_lease: () => ({ kind: 'absent' }),
    worktree_commits: () => [],
    history_graph: () => null,
    history_rebase_plan: (args: unknown) => {
      plans.push(args);
      return {
        onto: 'release-head',
        ontoRef: 'release/2.4',
        mergeBase: 'base-head',
        head: 'old-head',
        commits: [],
        behind: 4,
        fetchError: null,
      };
    },
    history_plan_predict: () => ({
      isSupported: true,
      head: 'new-head',
      steps: [],
      isTreeEqual: false,
      changedFiles: [],
    }),
    history_plan_try: () => ({
      head: 'new-head',
      map: [],
      isTreeEqual: false,
      changedFiles: [],
      stop: null,
      copyPath: null,
      order: [],
      check: null,
    }),
    history_plan_apply: () => ({
      kind: 'moved',
      head: 'new-head',
      backupRef: 'refs/goodboy/backup/hl-ledger-export/1',
      carriedCount: 0,
    }),
  });
});

describe('rebasing onto a chosen base through the real store', () => {
  it('plans against the chosen branch instead of the project base', async () => {
    await expect(
      store.getState().rebaseBranch({ ...input, ontoBranch: 'release/2.4' }),
    ).resolves.toBe('rebased');

    expect(plans[0]).toMatchObject({ baseBranch: 'release/2.4' });
  });

  it('keeps planning against the project base when no branch is chosen', async () => {
    await store.getState().rebaseBranch(input);

    expect(plans[0]).toMatchObject({ baseBranch: 'main' });
  });
});
