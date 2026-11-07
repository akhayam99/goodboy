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
  storySpies,
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
    worktree_diff_files: [],
    worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
    worktree_diff_working: '',
    worktree_status: cleanBranchAhead(),
    worktree_commits: [],
  });
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    worktree_diff_files: [],
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
      worktree_diff_files: [],
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

describe('useSessionDiff file list', () => {
  const ENTRIES = [
    {
      path: 'src/ledger/export.ts',
      oldPath: null,
      status: 'modified',
      additions: 12,
      deletions: 3,
      isBinary: false,
      isUntracked: false,
    },
    {
      path: 'notes/new.md',
      oldPath: null,
      status: 'added',
      additions: 4,
      deletions: 0,
      isBinary: false,
      isUntracked: true,
    },
  ];

  type Held = {
    release: () => void;
    fail: () => void;
  };

  const holdFullDiff = ({ list }: { readonly list: unknown }): Held => {
    const held: Held = { release: () => undefined, fail: () => undefined };
    stubStoryInvoke({
      worktree_diff_files: list,
      worktree_diff: ({ baseBranch }: BaseArgs) =>
        new Promise<string>((resolve, reject) => {
          held.release = () => resolve(patchFor(baseBranch));
          held.fail = () => reject(new Error('git failed'));
        }),
      worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
      worktree_commits: [],
    });
    return held;
  };

  it('shows the tree from the list while the full diff is still on its way', async () => {
    const held = holdFullDiff({ list: ENTRIES });
    const { result } = openWith({ mountBase: null, projectBase: 'main' });

    await waitFor(() => expect(result.current.files).toHaveLength(2));
    expect(result.current.loading).toBe(false);
    expect(result.current.bodies).not.toBeNull();
    expect(result.current.files.map((file) => [file.path, file.additions, file.deletions])).toEqual(
      [
        ['notes/new.md', 4, 0],
        ['src/ledger/export.ts', 12, 3],
      ],
    );
    expect(result.current.files.every((file) => file.hunks.length === 0)).toBe(true);

    act(() => held.release());

    await waitFor(() => expect(result.current.patch).toContain('against-main.txt'));
    expect(result.current.files.map((file) => file.path)).toEqual([
      'notes/new.md',
      'src/ledger/export.ts',
    ]);
  });

  it('drops a list that arrives after the full diff', async () => {
    const list = new Promise<unknown>(() => undefined);
    stubStoryInvoke({
      worktree_diff_files: () => list,
      worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
      worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
      worktree_commits: [],
    });
    const { result } = openWith({ mountBase: null, projectBase: 'main' });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bodies).toBeNull();
    expect(result.current.files.map((file) => file.path)).toEqual(['against-main.txt']);
    expect(result.current.files[0]?.hunks).toHaveLength(1);
  });

  it('keeps waiting for the full diff when the list is empty or fails', async () => {
    const held = holdFullDiff({ list: [] });
    const { result } = openWith({ mountBase: null, projectBase: 'main' });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.files).toHaveLength(0);
    expect(result.current.bodies).toBeNull();

    act(() => held.release());
    await waitFor(() => expect(result.current.files).toHaveLength(1));
  });

  it('keeps the tree when only the full diff for the patch fails', async () => {
    const held = holdFullDiff({ list: ENTRIES });
    const { result } = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(result.current.bodies).not.toBeNull());

    act(() => held.fail());

    await waitFor(() => expect(result.current.files).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(result.current.bodies).not.toBeNull();
  });

  it('does not ask for the list on the working tree view', async () => {
    holdFullDiff({ list: ENTRIES });
    const { result } = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(result.current.bodies).not.toBeNull());
    const listCalls = () =>
      storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'worktree_diff_files')
        .length;
    const before = listCalls();
    stubStoryInvoke({
      worktree_diff_files: ENTRIES,
      worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
      worktree_diff_working: '',
      worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
      worktree_commits: [],
    });

    act(() => result.current.setView({ kind: 'working', scope: 'all' }));

    await waitFor(() => expect(result.current.files).toHaveLength(0));
    expect(result.current.bodies).toBeNull();
    expect(listCalls()).toBe(before);
  });
});

describe('useSessionDiff file bodies', () => {
  const ENTRIES = [
    {
      path: 'src/ledger/export.ts',
      oldPath: null,
      status: 'modified',
      additions: 12,
      deletions: 3,
      isBinary: false,
      isUntracked: false,
    },
    {
      path: 'src/ledger/post.ts',
      oldPath: 'src/ledger/credit.ts',
      status: 'renamed',
      additions: 2,
      deletions: 1,
      isBinary: false,
      isUntracked: false,
    },
    {
      path: 'assets/logo.png',
      oldPath: null,
      status: 'added',
      additions: 0,
      deletions: 0,
      isBinary: true,
      isUntracked: false,
    },
  ];

  const bodyPatch = (path: string): string =>
    [
      `diff --git a/${path} b/${path}`,
      'index 1111111..2222222 100644',
      `--- a/${path}`,
      `+++ b/${path}`,
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');

  type FileArgs = BaseArgs & { readonly path: string; readonly oldPath?: string };

  type Gate = { release: () => void; fail: () => void };

  const stubBodies = (): { readonly gates: Map<string, Gate> } => {
    const gates = new Map<string, Gate>();
    stubStoryInvoke({
      worktree_diff_files: ENTRIES,
      worktree_diff: patchFor(null),
      worktree_diff_working: '',
      worktree_diff_file: ({ path }: FileArgs) =>
        new Promise<string>((resolve, reject) => {
          gates.set(path, {
            release: () => resolve(bodyPatch(path)),
            fail: () => reject(new Error('git failed')),
          });
        }),
      worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
      worktree_commits: [],
    });
    return { gates };
  };

  const openLazy = async () => {
    const view = openWith({ mountBase: null, projectBase: 'main' });
    await waitFor(() => expect(view.result.current.bodies).not.toBeNull());
    return view;
  };

  const gateOf = (gates: Map<string, Gate>, path: string): Gate => {
    const gate = gates.get(path);
    if (gate === undefined) {
      throw new Error(`no request for ${path}`);
    }
    return gate;
  };

  it('fetches nothing for a file until it is asked for', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();

    expect(gates.size).toBe(0);
    expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('pending');
  });

  it('fetches one file when it is asked for and keeps the list counts on the loaded file', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();

    act(() => result.current.bodies?.request({ path: 'src/ledger/export.ts' }));
    act(() => result.current.bodies?.request({ path: 'src/ledger/export.ts' }));
    await waitFor(() => expect(gates.size).toBe(1));
    act(() => gateOf(gates, 'src/ledger/export.ts').release());

    await waitFor(() =>
      expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('loaded'),
    );
    const loaded = result.current.files.find((file) => file.path === 'src/ledger/export.ts');
    expect(loaded?.hunks).toHaveLength(1);
    expect([loaded?.additions, loaded?.deletions]).toEqual([12, 3]);
    expect(result.current.bodies?.stateOf({ path: 'src/ledger/post.ts' })).toBe('pending');
  });

  it('asks for a renamed file with its old path', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();

    act(() => result.current.bodies?.request({ path: 'src/ledger/post.ts' }));

    await waitFor(() => expect(gates.size).toBe(1));
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith(
      'worktree_diff_file',
      expect.objectContaining({ path: 'src/ledger/post.ts', oldPath: 'src/ledger/credit.ts' }),
    );
  });

  it('counts a binary file as loaded without asking for it', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();

    act(() => result.current.bodies?.request({ path: 'assets/logo.png' }));

    expect(result.current.bodies?.stateOf({ path: 'assets/logo.png' })).toBe('loaded');
    expect(gates.size).toBe(0);
  });

  it('marks a failed file and loads it again on retry', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();

    act(() => result.current.bodies?.request({ path: 'src/ledger/export.ts' }));
    await waitFor(() => expect(gates.size).toBe(1));
    act(() => gateOf(gates, 'src/ledger/export.ts').fail());
    await waitFor(() =>
      expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('failed'),
    );

    act(() => result.current.bodies?.retry({ path: 'src/ledger/export.ts' }));
    expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('pending');
    await waitFor(() =>
      expect(
        storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'worktree_diff_file'),
      ).toHaveLength(2),
    );
    act(() => gateOf(gates, 'src/ledger/export.ts').release());

    await waitFor(() =>
      expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('loaded'),
    );
  });

  it('drops a body that arrives after the view changed', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();
    act(() => result.current.bodies?.request({ path: 'src/ledger/export.ts' }));
    await waitFor(() => expect(gates.size).toBe(1));

    act(() => result.current.setView({ kind: 'working', scope: 'all' }));
    await waitFor(() => expect(result.current.bodies).toBeNull());
    act(() => gateOf(gates, 'src/ledger/export.ts').release());

    expect(result.current.files).toHaveLength(0);
    expect(result.current.bodies).toBeNull();
  });

  it('keeps a loaded body on screen through a refresh and asks for it again', async () => {
    const { gates } = stubBodies();
    const { result } = await openLazy();
    act(() => result.current.bodies?.request({ path: 'src/ledger/export.ts' }));
    await waitFor(() => expect(gates.size).toBe(1));
    act(() => gateOf(gates, 'src/ledger/export.ts').release());
    await waitFor(() =>
      expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('loaded'),
    );

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(result.current.bodies?.stateOf({ path: 'src/ledger/export.ts' })).toBe('loaded');
    act(() => result.current.bodies?.request({ path: 'src/ledger/export.ts' }));
    await waitFor(() =>
      expect(
        storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'worktree_diff_file'),
      ).toHaveLength(2),
    );
  });
});

describe('useSessionDiff target switch', () => {
  const OTHER = '/repo/notify-relay';

  const commitOf = (sha: string) => ({
    sha,
    shortSha: sha.slice(0, 7),
    subject: 'Tighten the refund rounding',
    timestamp: 1_700_000_000,
    pushed: false,
  });

  const switchable = () => {
    const held: { release: () => void; fail: () => void } = {
      release: () => undefined,
      fail: () => undefined,
    };
    stubStoryInvoke({
      worktree_diff_files: [],
      worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
      worktree_status: ({ worktreePath }: BaseArgs) =>
        worktreePath === OTHER
          ? new Promise<WorktreeStatus>((resolve, reject) => {
              held.release = () => resolve(statusFor('other'));
              held.fail = () => reject(new Error('git status failed'));
            })
          : cleanBranchAhead(),
      worktree_commits: ({ worktreePath }: BaseArgs) =>
        worktreePath === OTHER ? [] : [commitOf('aaaaaaa1'), commitOf('bbbbbbb2')],
    });
    return held;
  };

  const mountedOn = (initial: string) => {
    const project = aProject({ baseBranch: 'main' });
    useAppStore.setState({ projects: [project], sessions: [session] });
    return renderHook(
      ({ path }: { readonly path: string }) =>
        useSessionDiff({ sessionId: SESSION_ID, worktreePath: path }),
      { initialProps: { path: initial } },
    );
  };

  it('shows no commit or status of the previous target while the new read is pending', async () => {
    const held = switchable();
    const { result, rerender } = mountedOn(WORKTREE);
    await waitFor(() => expect(result.current.commits).toHaveLength(2));
    await waitFor(() => expect(result.current.status?.mainDistance.kind).toBe('known'));

    rerender({ path: OTHER });

    expect(result.current.commits).toHaveLength(0);
    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(true);

    act(() => held.release());

    await waitFor(() => expect(result.current.status?.branch).toBe('against-other'));
    expect(result.current.commits).toHaveLength(0);
  });

  it('keeps the count unknown and shows the error when the new read fails', async () => {
    const held = switchable();
    const { result, rerender } = mountedOn(WORKTREE);
    await waitFor(() => expect(result.current.commits).toHaveLength(2));

    rerender({ path: OTHER });
    act(() => held.fail());

    await waitFor(() => expect(result.current.metaError).not.toBeNull());
    expect(result.current.status).toBeNull();
    expect(result.current.commits).toHaveLength(0);
  });
});
