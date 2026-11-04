import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId } from '@goodboy/types/testing';
import { brandId, type ProjectId, type SessionId } from '@goodboy/types';
import { mountAutoProject } from './runtime/auto/mount/mountAutoProject';
import type { MountProjectParams } from './runtime/auto/ports';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const elsewhere = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Northwind',
  slug: 'northwind',
});
const BRANCH = 'ak/feat-new-explore';
const REASON = 'The user asked for a worktree.';

const projectNamed = (name: string, workspaceId = workspace.id) =>
  buildStoryProject({
    id: brandId<ProjectId>({
      value: `project-${workspace.id === workspaceId ? '' : 'other-'}${name}`,
    }),
    workspaceId,
    name,
    kind: 'repo',
    rootPath: `/work/${workspaceId === workspace.id ? 'harborline' : 'northwind'}/${name}`,
  });

const ledger = projectNamed('ledger-core');
const relay = projectNamed('notify-relay');
const payments = projectNamed('payments-api');
const portal = projectNamed('acme-portal');
const otherRelay = projectNamed('notify-relay', elsewhere.id);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const mountedProjects = async (sessionId: SessionId) =>
  (
    await rowsOf<{ project_id: string; branch: string }>({
      sql: 'SELECT project_id, branch FROM session_worktrees WHERE session_id = ? ORDER BY project_id',
      params: [sessionId],
    })
  ).map((row) => ({ projectId: row.project_id, branch: row.branch }));

const bootSession = async (): Promise<SessionId> => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: 'generic',
  });
  return session.id;
};

type CallParams = {
  readonly sessionId: SessionId;
  readonly name: string;
  readonly mode: MountProjectParams['mode'];
  readonly branch?: string | null;
};

const call = ({ sessionId, name, mode, branch = BRANCH }: CallParams) =>
  mountAutoProject({
    get: useAppStore.getState,
    params: { sessionId, name, branch, reason: REASON, mode },
  });

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertWorkspace({ db, workspace: elsewhere });
  for (const project of [ledger, relay, payments, portal, otherRelay]) {
    await insertProject({ db, project });
  }
  useAppStore.setState({
    workspaces: [workspace, elsewhere],
    currentWorkspaceId: workspace.id,
    projects: [ledger, relay, payments, portal, otherRelay],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  storySpies.createWorktree.mockReset();
  storySpies.createWorktree.mockImplementation(async (args: unknown) => {
    const repoPath = Reflect.get(Object(args), 'repoPath');
    const branchName = Reflect.get(Object(args), 'branchName');
    return {
      worktreePath: `${String(repoPath)}/.goodboy/worktrees/export`,
      branchName: typeof branchName === 'string' ? branchName : 'goodboy/export',
      slug: 'export',
      reused: false,
    };
  });
});

describe('mountAutoProject on the real store', () => {
  it('finds the project by name in the workspace of that session and mounts it on the branch', async () => {
    const sessionId = await bootSession();
    const ensure = vi.spyOn(useAppStore.getState(), 'ensureProjectMounted');
    useAppStore.setState({ ensureProjectMounted: ensure });

    const outcome = await call({ sessionId, name: ' Notify-Relay ', mode: 'mount' });

    expect(ensure).toHaveBeenCalledWith({
      sessionId,
      projectId: relay.id,
      reason: REASON,
      branch: BRANCH,
    });
    expect(outcome).toEqual({ kind: 'mounted', name: 'notify-relay', branch: BRANCH });
    expect(await mountedProjects(sessionId)).toEqual([{ projectId: relay.id, branch: BRANCH }]);
  });

  it('never reaches a project of another workspace', async () => {
    const sessionId = await bootSession();
    useAppStore.setState({ projects: [otherRelay] });

    const outcome = await call({ sessionId, name: 'notify-relay', mode: 'mount' });

    expect(outcome).toEqual({ kind: 'unknown' });
    expect(await mountedProjects(sessionId)).toEqual([]);
  });

  it('asks without touching the disk at Every step', async () => {
    const sessionId = await bootSession();

    const outcome = await call({ sessionId, name: 'ledger-core', mode: 'ask' });

    expect(outcome).toEqual({ kind: 'ask', name: 'ledger-core' });
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(await mountedProjects(sessionId)).toEqual([]);
  });

  it('mounts under the allowance, then asks once the allowance is used up', async () => {
    const sessionId = await bootSession();

    const first = await call({ sessionId, name: 'ledger-core', mode: 'allowance' });
    const second = await call({ sessionId, name: 'notify-relay', mode: 'allowance' });
    const third = await call({ sessionId, name: 'payments-api', mode: 'allowance' });
    const fourth = await call({ sessionId, name: 'acme-portal', mode: 'allowance' });

    expect([first.kind, second.kind, third.kind]).toEqual(['mounted', 'mounted', 'mounted']);
    expect(fourth).toEqual({ kind: 'ask', name: 'acme-portal' });
    expect(await mountedProjects(sessionId)).toHaveLength(3);
  });

  it('reports a failed mount with its reason and leaves nothing mounted', async () => {
    const sessionId = await bootSession();
    storySpies.createWorktree.mockRejectedValue(new Error('the branch is in use'));

    const outcome = await call({ sessionId, name: 'ledger-core', mode: 'mount' });

    expect(outcome).toMatchObject({ kind: 'failed', name: 'ledger-core' });
    expect(outcome.kind === 'failed' ? outcome.error : '').toContain('the branch is in use');
    expect(await mountedProjects(sessionId)).toEqual([]);
  });

  it('says the project is on another branch instead of claiming the named one', async () => {
    const sessionId = await bootSession();
    await call({ sessionId, name: 'ledger-core', mode: 'mount', branch: 'ak/old-branch' });

    const outcome = await call({ sessionId, name: 'ledger-core', mode: 'mount' });

    expect(outcome).toEqual({
      kind: 'elsewhere',
      name: 'ledger-core',
      branch: 'ak/old-branch',
      requested: BRANCH,
    });
    expect(await mountedProjects(sessionId)).toEqual([
      { projectId: ledger.id, branch: 'ak/old-branch' },
    ]);
  });

  it('reports a project already on the named branch, or with no branch named, as mounted', async () => {
    const sessionId = await bootSession();
    await call({ sessionId, name: 'ledger-core', mode: 'mount' });

    expect(await call({ sessionId, name: 'ledger-core', mode: 'mount' })).toEqual({
      kind: 'mounted',
      name: 'ledger-core',
      branch: BRANCH,
    });
    expect(await call({ sessionId, name: 'ledger-core', mode: 'mount', branch: null })).toEqual({
      kind: 'mounted',
      name: 'ledger-core',
      branch: BRANCH,
    });
  });
});
