import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  PermissionRule,
  PermissionRuleId,
  ProjectId,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';

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

const runTurnSpy = storySpies.runTurn;
const permissionRuleListSpy = storySpies.invokePermissionRuleList;

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const AGENT_ID = 'agent-1' as AgentId;

function buildSession(): Session {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: now },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic',
      allowTurnOverride: false,
    },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildRule(overrides: Partial<PermissionRule>): PermissionRule {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
  return {
    id: 'rule-1' as PermissionRuleId,
    scope: 'session',
    sessionId: SESSION_ID,
    pattern: { tool: 'Edit' },
    decision: 'allow',
    priority: 100,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('sendTurn, permission proxy integration', () => {
  beforeEach(async () => {
    resetStorySpies();
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockReset();
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-3-5-sonnet-latest',
      reason: 'preference',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupSession(useAppStore: Awaited<ReturnType<typeof importStore>>) {
    const defaultAgent: Agent = {
      id: AGENT_ID,
      sessionId: SESSION_ID,
      ordinal: 0,
      name: 'agent 1',
      status: 'pending',
    };
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: 'project-turn' as ProjectId,
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/turn',
            mountId: 'mount-fixture-1' as MountId,
            sessionId: SESSION_ID,
            lastWorktreePath: null,
            baseBranch: null,
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 0,
          },
        ],
      },
      sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
      selectedAgentId: { [SESSION_ID]: defaultAgent.id },
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: {
        anthropic: { state: 'connected', identity: 'test' },
        cursor: { state: 'connected', identity: 'test' },
        codex: { state: 'connected', identity: 'test' },
      } as never,
      workspaces: [
        {
          id: WORKSPACE_ID,
          name: 'ws',
          slug: 'ws',
          overrides: {
            defaultProviderId: null,
            defaultBranchPrefix: null,
            defaultVerbosity: null,
            providerBindings: null,
            taskModels: null,
            roleModels: null,
            parallelAgents: null,
            providerPool: null,
            attributionFooter: null,
            replyVoice: null,
            replyStyleNote: null,
            replyTemplateFixed: null,
            replyTemplateNoChange: null,
            resolveOnGithub: null,
            resolveCommitStyle: null,
            afterMerge: null,
            defaultBranchTemplate: null,
          },
          createdAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        },
      ],
    });
  }

  it('forwards disallowedTools when a deny rule is configured (claude)', async () => {
    permissionRuleListSpy.mockImplementation(async (args: { scope: string }) => {
      if (args.scope === 'session') {
        return [
          buildRule({
            decision: 'deny',
            pattern: { tool: 'Bash', argsMatcher: 'rm:*' },
          }),
        ];
      }
      return [];
    });
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.disallowedTools).toEqual(['Bash(rm:*)']);
    expect(args.allowedTools).toEqual([]);
    expect(args.permissionMode).toBe('bypassPermissions');
  });

  it('forwards allowedTools when an allow rule is configured (claude)', async () => {
    permissionRuleListSpy.mockImplementation(async (args: { scope: string }) => {
      if (args.scope === 'session') {
        return [buildRule({ decision: 'allow', pattern: { tool: 'Edit' } })];
      }
      return [];
    });
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.allowedTools).toEqual(['Edit']);
    expect(args.disallowedTools).toEqual([]);
  });

  it('forwards empty tool lists with default mode when no rules exist (claude)', async () => {
    permissionRuleListSpy.mockResolvedValue([]);
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.allowedTools).toEqual([]);
    expect(args.disallowedTools).toEqual([]);
    expect(args.permissionMode).toBe('bypassPermissions');
    expect(JSON.stringify(args)).not.toContain('dangerously-skip-permissions');
  });

  it('keeps scout restrictions in copy instead of enforcing read-only tools', async () => {
    setupSession(useAppStore);
    useAppStore.setState({ agentKindOverride: { [AGENT_ID]: 'scout' } });
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'inspect' });

    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.systemPrompt).toContain('FORBIDDEN: editing files');
    expect(args.allowedTools).toEqual([]);
    expect(args.disallowedTools).toEqual([]);
    expect(args.permissionMode).toBe('bypassPermissions');
  });

  it('sends the mode but not the rules when provider is cursor', async () => {
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      selectedProvider: 'cursor',
      selectedModel: 'cursor-default',
      reason: 'preference',
    });
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.allowedTools).toBeUndefined();
    expect(args.disallowedTools).toBeUndefined();
    expect(args.permissionMode).toBe('bypassPermissions');
    expect(permissionRuleListSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['codex', 'default', 'plan'],
    ['codex', 'acceptEdits', 'acceptEdits'],
    ['gemini', 'acceptEdits', 'acceptEdits'],
    ['cursor', 'acceptEdits', 'plan'],
    ['opencode', 'dontAsk', 'plan'],
    ['anthropic', 'default', 'default'],
  ] as const)('sends %s the stricter mode it can honor for %s', async (provider, mode, sent) => {
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      selectedProvider: provider,
      selectedModel: 'model-1',
      reason: 'preference',
    });
    setupSession(useAppStore);
    useAppStore.setState({ sessions: [{ ...buildSession(), permissionMode: mode }] });
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.permissionMode).toBe(sent);
  });

  it('marks the agent turn blocked when the stream reports a permission request', async () => {
    const runId = 'run-blocked' as ProviderRunId;
    runTurnSpy.mockImplementation(async function* (): AsyncIterable<TurnEvent> {
      yield {
        kind: 'permission_request',
        runId,
        toolUseId: 'toolu_1',
        toolName: 'Write',
        input: { file_path: '/tmp/wt/out.txt' },
        at: '2026-05-07T00:00:00.000Z' as IsoDateTime,
      };
    });
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    expect(useAppStore.getState().agentTurnState[AGENT_ID]?.kind).toBe('blocked');
  });

  it('retryBlockedTool re-sends the turn with a prompt naming the approved tool', async () => {
    setupSession(useAppStore);
    useAppStore.setState({
      agentTurnState: {
        [AGENT_ID]: {
          kind: 'blocked',
          runId: 'run-blocked' as ProviderRunId,
          blockedAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        },
      },
    });

    await useAppStore
      .getState()
      .retryBlockedTool({ sessionId: SESSION_ID, agentId: AGENT_ID, toolName: 'Bash' });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const args = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(args.prompt)).toContain('Permission for Bash is now granted.');
  });

  it('retryBlockedTool does nothing while that agent is still running', async () => {
    setupSession(useAppStore);
    useAppStore.setState({
      agentTurnState: {
        [AGENT_ID]: {
          kind: 'running',
          runId: 'run-live' as ProviderRunId,
          startedAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        },
      },
    });

    await useAppStore
      .getState()
      .retryBlockedTool({ sessionId: SESSION_ID, agentId: AGENT_ID, toolName: 'Bash' });

    expect(runTurnSpy).not.toHaveBeenCalled();
  });
});
