// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX } from '../../../../../settings/settings';
import {
  emptyOverrides,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import type { MountPlan } from '../../../../../../store/slices/sessions/mountPlan';

const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;
const SID = 'ab12cd34-ef56-7890' as SessionId;
const PID = 'project-1' as ProjectId;
const WID = 'workspace-1' as WorkspaceId;
const MID = 'mount-1' as MountId;

const repoProject = {
  id: PID,
  workspaceId: WID,
  name: 'goodboy',
  kind: 'repo',
  rootPath: '/repos/goodboy',
  baseBranch: 'main',
  overrides: emptyOverrides,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Project;

const session = {
  id: SID,
  workspaceId: WID,
  goal: 'Ship the rebase row',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Session;

const h = {
  listBranchNames: vi.fn<(params: { readonly repoPath: string }) => Promise<Array<string>>>(),
};

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

let useAppStore: StoryStore;
beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

import { useMountPreflight } from './index';
import { resolveMountPreflight } from './resolveMountPreflight';

const planFor = (overrides: Partial<MountPlan> = {}): MountPlan => ({
  project: repoProject,
  mountId: MID,
  naming: { template: '{prefix}/{task-id}-{slug}', values: { prefix: 'ak', slug: 'ship-it' } },
  slug: 'ship-it',
  branch: 'ak/ship-it',
  adoptedBranch: null,
  baseBranch: 'main',
  targetPath: '/repos/goodboy/.goodboy/worktrees/gb-7k2q9x',
  takenBranches: [],
  ...overrides,
});

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    worktree_list_branch_names: () => h.listBranchNames({ repoPath: repoProject.rootPath }),
    session_dir_exists: false,
  });
  h.listBranchNames.mockReset();
  useAppStore.setState({
    sessions: [session],
    archivedSessions: {},
    projects: [repoProject],
    workspaceOverrides: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts: {},
    sessionExternalTasks: {},
  });
});

afterEach(cleanup);

describe('resolveMountPreflight', () => {
  it('keeps the proposed branch when nothing in the repository claims it', () => {
    const resolved = resolveMountPreflight({ plan: planFor(), repoBranches: ['main', 'ak/other'] });

    expect(resolved.branch).toBe('ak/ship-it');
    expect(resolved.renamedFrom).toBeNull();
    expect(resolved.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/gb-7k2q9x');
  });

  it('proposes an alternative and a matching path when the branch already exists', () => {
    const resolved = resolveMountPreflight({
      plan: planFor(),
      repoBranches: ['main', 'ak/ship-it'],
    });

    expect(resolved.renamedFrom).toBe('ak/ship-it');
    expect(resolved.branch).toBe('ak/ship-it-2');
    expect(resolved.slug).toBe('ship-it-2');
    expect(resolved.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/gb-7k2q9x');
  });

  it('suffixes from the base slug once when the planned suffix is also taken in the repository', () => {
    const resolved = resolveMountPreflight({
      plan: planFor({
        naming: { template: '{prefix}/{slug}', values: { prefix: 'ak', slug: 'x' } },
        slug: 'x-2',
        branch: 'ak/x-2',
        targetPath: '/repos/goodboy/.goodboy/worktrees/gb-7k2q9x',
        takenBranches: ['ak/x'],
      }),
      repoBranches: ['main', 'ak/x-2'],
    });

    expect(resolved.slug).toBe('x-3');
    expect(resolved.branch).toBe('ak/x-3');
    expect(resolved.renamedFrom).toBe('ak/x-2');
    expect(resolved.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/gb-7k2q9x');
  });

  it('never renames a branch the session is adopting on purpose', () => {
    const resolved = resolveMountPreflight({
      plan: planFor({ adoptedBranch: 'ak/existing' }),
      repoBranches: ['ak/existing', 'ak/ship-it'],
    });

    expect(resolved.branch).toBe('ak/existing');
    expect(resolved.renamedFrom).toBeNull();
  });

  it('leaves a folder project without a branch or a base', () => {
    const resolved = resolveMountPreflight({
      plan: planFor({ branch: null, baseBranch: null, targetPath: '/notes/sessions/ship-it' }),
      repoBranches: ['main'],
    });

    expect(resolved.branch).toBeNull();
    expect(resolved.baseBranch).toBeNull();
    expect(resolved.renamedFrom).toBeNull();
  });
});

type TransactionParams = { readonly statements: ReadonlyArray<unknown> };

type CreateParams = {
  readonly args: {
    readonly parentDir: string;
    readonly dirName: string;
    readonly branchName: string;
  };
};

describe('useMountPreflight', () => {
  it('confirms the allocated folder and creates that exact folder after a collision', async () => {
    let probes = 0;
    const create = vi.fn(({ args }: CreateParams) => ({
      worktreePath: `${args.parentDir}/${args.dirName}`,
      branchName: args.branchName,
      slug: args.dirName,
    }));
    stubStoryInvoke({
      worktree_list_branch_names: [],
      session_dir_exists: () => {
        probes += 1;
        return probes === 1;
      },
      worktree_inspect: {
        kind: 'foreign-directory',
        path: '/repos/Harborline/.goodboy/worktrees/gb-taken',
      },
      worktree_create: create,
      gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
      worktree_setup_proposal: null,
      db_select: [],
      db_execute: { rowsAffected: 1, lastInsertId: null },
      db_transaction: ({ statements }: TransactionParams) => ({
        status: 'committed',
        results: statements.map(() => ({ rowsAffected: 1, rows: [] })),
      }),
    });
    const { result } = renderHook(() =>
      useMountPreflight({ sessionId: SID, project: repoProject }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const preflight = result.current.preflight;
    if (preflight === null || preflight.branch === null) {
      throw new Error('The mount preview is missing.');
    }
    expect(probes).toBe(2);
    const input = {
      sessionId: SID,
      projectId: PID,
      mountId: preflight.mountId,
      reason: 'Add payments-api',
      branch: preflight.branch,
      dirName: preflight.targetPath.split('/').at(-1),
    };
    create.mockImplementationOnce(() => {
      throw new Error('The worktree could not be created.');
    });
    await expect(useAppStore.getState().ensureProjectMounted(input)).rejects.toThrow(
      'The worktree could not be created.',
    );
    expect(useAppStore.getState().sessionProjectMounts[SID] ?? []).toHaveLength(0);
    await useAppStore.getState().ensureProjectMounted(input);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0].args.dirName).toBe(create.mock.calls[1]?.[0].args.dirName);
    expect(probes).toBe(2);
    expect(useAppStore.getState().sessionProjectMounts[SID]?.[0]?.worktreePath).toBe(
      preflight.targetPath,
    );
  });
  it('stays idle with no project selected', () => {
    const { result } = renderHook(() => useMountPreflight({ sessionId: SID, project: null }));

    expect(result.current.status).toBe('idle');
    expect(result.current.preflight).toBeNull();
    expect(h.listBranchNames).not.toHaveBeenCalled();
  });

  it('shows the plan while checking, then the repository verdict', async () => {
    const derived = `${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row`;
    h.listBranchNames.mockResolvedValue(['main', derived]);
    const { result } = renderHook(() =>
      useMountPreflight({ sessionId: SID, project: repoProject }),
    );

    expect(result.current.status).toBe('checking');
    expect(result.current.preflight).toBeNull();

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(h.listBranchNames).toHaveBeenCalledWith({ repoPath: '/repos/goodboy' });
    expect(result.current.preflight?.renamedFrom).toBe(derived);
    expect(result.current.preflight?.branch).toBe(`${derived}-2`);
  });

  it('keeps the plan and reports the cause when the branch scan fails', async () => {
    h.listBranchNames.mockRejectedValue(new Error('not a git repository'));
    const { result } = renderHook(() =>
      useMountPreflight({ sessionId: SID, project: repoProject }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.branchScanError).toContain('not a git repository');
    expect(result.current.preflight?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row`);
  });

  it('skips the branch scan for a folder project', async () => {
    const folder = { ...repoProject, kind: 'folder' } satisfies Project;
    useAppStore.setState({ projects: [folder] });
    const { result } = renderHook(() => useMountPreflight({ sessionId: SID, project: folder }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(h.listBranchNames).not.toHaveBeenCalled();
    expect(result.current.preflight?.branch).toBeNull();
  });
});
