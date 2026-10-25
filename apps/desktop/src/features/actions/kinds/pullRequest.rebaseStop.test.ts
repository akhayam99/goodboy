import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import { brandId, type MountId, type WorktreeStatus } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  ensure,
  resetWorktreeStatusCache,
  worktreeStatusKey,
} from '../../../store/runtime/worktreeStatuses/cache';
import { PULL_REQUEST_KIND } from './pullRequest';

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

const WORKSPACE = aWorkspace();
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const WORKTREE = '/worktrees/ledger-core';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  store.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    sessions: [SESSION],
    sessionActiveMount: { [SESSION.id]: MOUNT },
    sessionActiveProject: { [SESSION.id]: PROJECT.id },
    sessionProjectMounts: {
      [SESSION.id]: [
        {
          mountId: MOUNT,
          sessionId: SESSION.id,
          projectId: PROJECT.id,
          mountName: 'ledger-core',
          worktreePath: WORKTREE,
          lastWorktreePath: WORKTREE,
          repoRoot: '/repos/ledger-core',
          branch: 'hl/feat-rates',
          baseBranch: 'main',
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
  });
});

type GitParams = {
  readonly inProgress: WorktreeStatus['inProgress'];
};

const gitStatusOf = ({ inProgress }: GitParams): WorktreeStatus => ({
  branch: 'hl/feat-rates',
  head: 'c0ffee1',
  headSubject: 'Round rates half to even',
  upstream: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 2, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress,
});

const readGit = async ({ inProgress }: GitParams): Promise<void> => {
  stubStoryInvoke({ worktree_status: () => gitStatusOf({ inProgress }) });
  await ensure({
    key: worktreeStatusKey({ worktreePath: WORKTREE, baseBranch: 'main' }),
    worktreePath: WORKTREE,
    baseBranch: 'main',
    maxAgeMs: 0,
  });
};

type TargetParams = {
  readonly mountId: MountId | null;
};

const stopOpenFor = ({ mountId }: TargetParams): boolean =>
  PULL_REQUEST_KIND.facts({
    state: store.getState(),
    target: { kind: 'pullRequest', sessionId: SESSION.id, mountId, prNumber: null },
  })?.isRebaseStopOpen === true;

describe('the pull request facts and a rebase started in a terminal', () => {
  it('hold the merge for the mount named, with no Goodboy run or event', async () => {
    await readGit({ inProgress: 'rebase' });

    expect(stopOpenFor({ mountId: MOUNT })).toBe(true);
  });

  it('hold the merge for a palette target that names no mount, through the write destination', async () => {
    await readGit({ inProgress: 'rebase' });

    expect(stopOpenFor({ mountId: null })).toBe(true);
  });

  it('hold nothing while git is not rebasing', async () => {
    await readGit({ inProgress: null });

    expect(stopOpenFor({ mountId: MOUNT })).toBe(false);
    expect(stopOpenFor({ mountId: null })).toBe(false);
  });
});
