// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { emptyOverrides } from '../../../../../../store/storyHarness';
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

const h = vi.hoisted(() => ({
  listBranchNames: vi.fn<(params: { readonly repoPath: string }) => Promise<Array<string>>>(),
  state: {} as Record<string, unknown>,
}));

vi.mock('../../../../../worktree/worktree', () => ({ listBranchNames: h.listBranchNames }));
vi.mock('../../../../../../store', () => ({ useAppStore: { getState: () => h.state } }));

import { useMountPreflight } from './index';
import { resolveMountPreflight } from './resolveMountPreflight';

const planFor = (overrides: Partial<MountPlan> = {}): MountPlan => ({
  project: repoProject,
  mountId: MID,
  prefix: 'ak',
  slug: 'ship-it',
  branch: 'ak/ship-it',
  adoptedBranch: null,
  baseBranch: 'main',
  targetPath: '/repos/goodboy/.goodboy/worktrees/ship-it-mount-1',
  takenBranches: [],
  ...overrides,
});

beforeEach(() => {
  h.listBranchNames.mockReset();
  h.state = {
    sessions: [session],
    archivedSessions: {},
    projects: [repoProject],
    workspaceOverrides: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts: {},
    sessionExternalTasks: {},
  };
});

afterEach(cleanup);

describe('resolveMountPreflight', () => {
  it('keeps the proposed branch when nothing in the repository claims it', () => {
    const resolved = resolveMountPreflight({ plan: planFor(), repoBranches: ['main', 'ak/other'] });

    expect(resolved.branch).toBe('ak/ship-it');
    expect(resolved.renamedFrom).toBeNull();
    expect(resolved.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/ship-it-mount-1');
  });

  it('proposes an alternative and a matching path when the branch already exists', () => {
    const resolved = resolveMountPreflight({
      plan: planFor(),
      repoBranches: ['main', 'ak/ship-it'],
    });

    expect(resolved.renamedFrom).toBe('ak/ship-it');
    expect(resolved.branch).toBe('ak/ship-it-2');
    expect(resolved.slug).toBe('ship-it-2');
    expect(resolved.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/ship-it-2-mount-1');
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

describe('useMountPreflight', () => {
  it('stays idle with no project selected', () => {
    const { result } = renderHook(() => useMountPreflight({ sessionId: SID, project: null }));

    expect(result.current.status).toBe('idle');
    expect(result.current.preflight).toBeNull();
    expect(h.listBranchNames).not.toHaveBeenCalled();
  });

  it('shows the plan while checking, then the repository verdict', async () => {
    const derived = `${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row-ab12cd34`;
    h.listBranchNames.mockResolvedValue(['main', derived]);
    const { result } = renderHook(() =>
      useMountPreflight({ sessionId: SID, project: repoProject }),
    );

    expect(result.current.status).toBe('checking');
    expect(result.current.preflight?.branch).toBe(derived);

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
    expect(result.current.preflight?.branch).toBe(
      `${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row-ab12cd34`,
    );
  });

  it('skips the branch scan for a folder project', async () => {
    const folder = { ...repoProject, kind: 'folder' } satisfies Project;
    h.state = { ...h.state, projects: [folder] };
    const { result } = renderHook(() => useMountPreflight({ sessionId: SID, project: folder }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(h.listBranchNames).not.toHaveBeenCalled();
    expect(result.current.preflight?.branch).toBeNull();
  });
});
