import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import {
  assistantTurnStream,
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
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
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const NOW = '2026-08-31T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-drift' as SessionId;
const WORKSPACE_ID = 'workspace-drift' as WorkspaceId;
const AGENT_ID = 'agent-drift' as AgentId;
const PROJECT_ID = 'project-drift' as ProjectId;

const DIFF_OUTPUT = 'here is the change:\n+const nextValue = compute();\n';

const reviewer = buildStoryAgent({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  name: 'review the auth rework',
});

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

describe('sendTurn boundary drift', () => {
  beforeEach(() => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(assistantTurnStream(DIFF_OUTPUT));
    storySpies.invokeAgentList.mockResolvedValue([reviewer] as never);
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'review the auth rework',
          state: { kind: 'idle', lastActivityAt: NOW },
        }),
      ],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: PROJECT_ID,
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/drift',
          },
        ],
      },
      sessionPhaseRuns: { [SESSION_ID]: [reviewer] },
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      agentKindOverride: { [AGENT_ID]: 'reviewer' },
      notifications: [],
      notificationCounts: { total: 0, unread: 0 },
      workspaces: [
        buildStoryWorkspace({
          id: WORKSPACE_ID,
          name: 'ws',
          slug: 'ws',
          sessionsRoot: '/tmp',
        }),
      ],
      ...connectedAnthropicState(),
    });
  });

  it('carries an open-agent action naming the drifting agent', async () => {
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_ID, content: 'review it' });

    await vi.waitFor(() =>
      expect(useAppStore.getState().notifications.some((n) => n.kind === 'boundary-drift')).toBe(
        true,
      ),
    );

    const drift = useAppStore.getState().notifications.find((n) => n.kind === 'boundary-drift');
    expect(drift?.action).toEqual({
      kind: 'open-agent',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });
    expect(drift?.title).toContain('drifted from reviewer role');
  });
});
