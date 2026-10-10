// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { MountId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { DiffFocus } from '../../../../store';
import { useSessionDiff } from '.';

const WORKTREE = '/repo/ledger-core';
const session = aSession({ goal: 'Check the ledger diff' });
const SESSION_ID = session.id;

type BaseArgs = { readonly worktreePath: string; readonly baseBranch: string | null };

const nameOf = (baseBranch: string | null): string =>
  `against-${(baseBranch ?? 'default').replace('/', '-')}`;

const patchFor = (baseBranch: string | null): string =>
  [
    `diff --git a/${nameOf(baseBranch)}.txt b/${nameOf(baseBranch)}.txt`,
    'index 1111111..2222222 100644',
    `--- a/${nameOf(baseBranch)}.txt`,
    `+++ b/${nameOf(baseBranch)}.txt`,
    '@@ -1 +1 @@',
    '-before',
    '+after',
    '',
  ].join('\n');

const statusFor = (baseBranch: string | null): WorktreeStatus => ({
  branch: nameOf(baseBranch),
  head: 'abc1234',
  headSubject: 'Tighten the refund rounding',
  upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  mainDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  workingTree: { kind: 'unknown', reason: 'status-read-failed' },
  upstream: null,
  inProgress: null,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const openWith = ({
  mountBase,
  projectBase,
  diffFocus = null,
}: {
  readonly mountBase: string | null;
  readonly projectBase: string | null;
  readonly diffFocus?: DiffFocus | null;
}) => {
  const project = aProject({ baseBranch: projectBase });
  const mount: SessionProjectMount = {
    mountId: 'mount-ledger' as MountId,
    sessionId: SESSION_ID,
    projectId: project.id,
    mountName: 'ledger-core',
    worktreePath: WORKTREE,
    lastWorktreePath: null,
    repoRoot: WORKTREE,
    branch: 'goodboy/check-ledger',
    baseBranch: mountBase,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  };
  useAppStore.setState({
    projects: [project],
    sessions: [session],
    sessionProjectMounts: { [SESSION_ID]: [mount] },
  });
  return renderHook(() =>
    useSessionDiff({ sessionId: SESSION_ID, worktreePath: WORKTREE, diffFocus }),
  );
};

const cleanBranchAhead = (): WorktreeStatus => ({
  ...statusFor(null),
  mainDistance: { kind: 'known', ahead: 6, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
});

const stubCleanTreeWithSixCommits = (): void => {
  stubStoryInvoke({
    worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
    worktree_diff_working: '',
    worktree_status: cleanBranchAhead(),
    worktree_commits: [],
  });
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
    worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
    worktree_commits: [],
  });
});

afterEach(cleanup);

describe('useSessionDiff base branch', () => {
  it('shows the diff and the status against the base the user picked', async () => {
    const { result } = openWith({ mountBase: null, projectBase: 'develop' });

    await waitFor(() =>
      expect(result.current.files.map((file) => file.path)).toEqual(['against-develop.txt']),
    );
    await waitFor(() => expect(result.current.status?.branch).toBe('against-develop'));
  });

  it('prefers the base recorded on the mount', async () => {
    const { result } = openWith({ mountBase: 'release/9', projectBase: 'develop' });

    await waitFor(() =>
      expect(result.current.files.map((file) => file.path)).toEqual(['against-release-9.txt']),
    );
  });

  it('keeps the backend default when the session has no explicit base', async () => {
    const { result } = openWith({ mountBase: null, projectBase: null });

    await waitFor(() =>
      expect(result.current.files.map((file) => file.path)).toEqual(['against-default.txt']),
    );
    await waitFor(() => expect(result.current.status?.branch).toBe('against-default'));
  });
});

describe('useSessionDiff scope', () => {
  it('opens on the branch scope when the working tree is clean and commits are ahead', async () => {
    stubCleanTreeWithSixCommits();
    const { result } = openWith({
      mountBase: null,
      projectBase: 'main',
      diffFocus: { kind: 'working', path: null },
    });

    await waitFor(() => expect(result.current.view).toEqual({ kind: 'branch' }));
    await waitFor(() => expect(result.current.files).toHaveLength(1));
  });

  it('keeps the working tree scope the owner picked', async () => {
    stubCleanTreeWithSixCommits();
    const { result } = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(result.current.status?.mainDistance.kind).toBe('known'));

    act(() => result.current.setView({ kind: 'working', scope: 'all' }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view).toEqual({ kind: 'working', scope: 'all' });
    expect(result.current.files).toHaveLength(0);
  });

  it('counts the branch files to offer from a clean working tree', async () => {
    stubCleanTreeWithSixCommits();
    const { result } = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(result.current.status?.mainDistance.kind).toBe('known'));

    act(() => result.current.setView({ kind: 'working', scope: 'all' }));

    await waitFor(() =>
      expect(result.current.alternate).toEqual({ view: { kind: 'branch' }, fileCount: 1 }),
    );
  });
});

describe('useSessionDiff refresh', () => {
  const holdNextDiff = () => {
    const held: { release: () => void } = { release: () => undefined };
    stubStoryInvoke({
      worktree_diff: ({ baseBranch }: BaseArgs) =>
        new Promise<string>((resolve) => {
          held.release = () => resolve(patchFor(baseBranch));
        }),
      worktree_diff_working: () =>
        new Promise<string>((resolve) => {
          held.release = () => resolve('');
        }),
      worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
      worktree_commits: [],
    });
    return held;
  };

  it('keeps the files on screen and flags a refresh instead of loading again', async () => {
    const { result } = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    const held = holdNextDiff();

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.files).toHaveLength(1);

    act(() => held.release());

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.loading).toBe(false);
    expect(result.current.files).toHaveLength(1);
  });

  it('loads from scratch when the scope changes', async () => {
    const { result } = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    const held = holdNextDiff();

    act(() => result.current.setView({ kind: 'working', scope: 'all' }));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.isRefreshing).toBe(false);

    act(() => held.release());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('shows the loading state on the first load', async () => {
    const { result } = openWith({ mountBase: null, projectBase: 'main' });

    expect(result.current.loading).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
