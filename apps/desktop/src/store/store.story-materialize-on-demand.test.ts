import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { stripControlMarkers } from '@goodboy/core';
import {
  assistantTurnStream,
  buildStoryAgent,
  buildStoryProject,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  recordedEvent,
  recordedEventKinds,
  resetStorySpies,
  storySpies,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../features/workspace/prepareSessionContainer', async () =>
  (await import('./storyHarness')).prepareSessionContainerModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const SESSION_ID = 'session-story' as SessionId;
const WORKSPACE_ID = 'workspace-story' as WorkspaceId;
const AGENT_ID = 'agent-story' as AgentId;
const APP_PROJECT_ID = 'project-app' as ProjectId;
const WEB_PROJECT_ID = 'project-web' as ProjectId;
const CONTAINER = '/tmp/sessions/goal-12345678';
const WEB_MOUNT_PATH = `${CONTAINER}/web`;
const WEB_BRANCH = 'goodboy/goal-12345678';

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID });
const appProject = buildStoryProject({ id: APP_PROJECT_ID, workspaceId: WORKSPACE_ID });
const webProject = buildStoryProject({
  id: WEB_PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'web',
  rootPath: '/tmp/web',
});
const session = buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });
const agent = buildStoryAgent({ id: AGENT_ID, sessionId: SESSION_ID });

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

const seedSession = (projects: ReadonlyArray<typeof appProject>) => {
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [session],
    archivedSessions: {},
    projects,
    sessionWorktrees: { [SESSION_ID]: [CONTAINER] },
    sessionProjectMounts: { [SESSION_ID]: [] },
    sessionBranches: { [SESSION_ID]: '' },
    sessionActiveProject: {},
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    ...connectedAnthropicState(),
  } as never);
};

const seedMountedWeb = () => {
  seedSession([appProject, webProject]);
  useAppStore.setState({
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          projectId: WEB_PROJECT_ID,
          mountName: 'web',
          repoRoot: '/tmp/web',
          worktreePath: WEB_MOUNT_PATH,
          branch: WEB_BRANCH,
        },
      ],
    },
    sessionWorktrees: { [SESSION_ID]: [CONTAINER, WEB_MOUNT_PATH] },
    sessionActiveProject: { [SESSION_ID]: WEB_PROJECT_ID },
    sessionBranches: { [SESSION_ID]: WEB_BRANCH },
  } as never);
};

const spawnedArgs = (): Record<string, unknown> =>
  (storySpies.runTurn.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

beforeEach(() => {
  resetStorySpies();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
});

describe('story: an agent scouts a workspace without touching any repo', () => {
  it('keeps a single-project first turn in the container, with no branch or worktree', async () => {
    seedSession([appProject]);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(spawnedArgs()['workingDir']).toBe(CONTAINER);
    const systemPrompt = String(spawnedArgs()['systemPrompt']);
    expect(systemPrompt).toContain('[workspace-scope]');
    expect(systemPrompt).toContain('app (repo) root: /tmp/app');
    expect(systemPrompt).toContain('NOT materialized');
    expect(useAppStore.getState().sessionBranches[SESSION_ID]).toBe('');
    expect(recordedEventKinds()).not.toContain('project_materialized');
  });

  it('keeps a multi-project session lazy and teaches the materialize marker instead', async () => {
    seedSession([appProject, webProject]);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(spawnedArgs()['workingDir']).toBe(CONTAINER);
    const systemPrompt = String(spawnedArgs()['systemPrompt']);
    expect(systemPrompt).toContain('[workspace-scope]');
    expect(systemPrompt).toContain('web (repo) root: /tmp/web');
    expect(systemPrompt).toContain('NOT materialized');
    expect(systemPrompt).toContain('<<materialize: <project name> | <why you need it>>>');
  });
});

describe('story: an agent asks for write access with the materialize marker', () => {
  it('mounts exactly the requested project, records why, and keeps the turn in the container', async () => {
    seedSession([appProject, webProject]);
    storySpies.createWorktree.mockResolvedValueOnce({
      worktreePath: WEB_MOUNT_PATH,
      branchName: WEB_BRANCH,
      slug: 'goal-12345678',
      reused: false,
    } as never);
    const assistantText = 'scanning done\n<<materialize: Web | need to patch the router>>\nnext';
    storySpies.runTurn.mockImplementation(assistantTurnStream(assistantText));

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(spawnedArgs()['workingDir']).toBe(CONTAINER);
    expect(storySpies.createWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath: '/tmp/web', parentDir: CONTAINER, dirName: 'web' }),
    );
    const mounts = useAppStore.getState().sessionProjectMounts[SESSION_ID] ?? [];
    expect(mounts.map((mount) => mount.projectId)).toEqual([WEB_PROJECT_ID]);
    expect(recordedEvent('project_materialized')?.payload).toMatchObject({
      projectName: 'web',
      reason: 'need to patch the router',
    });
    expect(useAppStore.getState().sessionBranches[SESSION_ID]).toBe(WEB_BRANCH);
    expect(stripControlMarkers(assistantText)).not.toContain('<<materialize');
  });

  it('refuses an unknown project name and notes it inline for the user', async () => {
    seedSession([appProject]);
    storySpies.runTurn.mockImplementation(
      assistantTurnStream('<<materialize: ghost | poking around>>'),
    );

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(recordedEvent('project_materialization_refused')?.payload).toMatchObject({
      projectName: 'ghost',
    });
    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const noteEvent = transcript.find(
      (event) => event.kind === 'error' && event.message.includes('no project named "ghost"'),
    );
    expect(noteEvent).toBeDefined();
  });
});

describe('story: the user detaches a project from the mounted strip', () => {
  it('removes a clean worktree along with its mount and records the detach', async () => {
    seedMountedWeb();

    await useAppStore
      .getState()
      .detachProject({ sessionId: SESSION_ID, projectId: WEB_PROJECT_ID });

    expect(storySpies.removeWorktree).toHaveBeenCalledWith('/tmp/web', WEB_MOUNT_PATH);
    expect(storySpies.deleteSessionWorktreeForProject).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, projectId: WEB_PROJECT_ID }),
    );
    expect(useAppStore.getState().sessionProjectMounts[SESSION_ID]).toEqual([]);
    expect(useAppStore.getState().sessionWorktrees[SESSION_ID]).toEqual([CONTAINER]);
    expect(recordedEvent('project_detached')?.payload).toMatchObject({
      projectName: 'web',
      kept: false,
    });
  });

  it('keeps a dirty worktree on disk and says why in the event', async () => {
    seedMountedWeb();
    storySpies.worktreeStatus.mockResolvedValueOnce({
      workingTree: { kind: 'known', staged: 0, unstaged: 2, untracked: 0, unmerged: 0 },
    } as never);

    await useAppStore
      .getState()
      .detachProject({ sessionId: SESSION_ID, projectId: WEB_PROJECT_ID });

    expect(storySpies.removeWorktree).not.toHaveBeenCalled();
    expect(useAppStore.getState().sessionProjectMounts[SESSION_ID]).toEqual([]);
    expect(recordedEvent('project_detached')?.payload).toMatchObject({
      kept: true,
      reason: 'uncommitted changes in the worktree',
    });
  });
});
