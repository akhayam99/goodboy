import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectId,
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
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

const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const STEP_AGENT_ID = 'agent-step' as AgentId;
const CLUSTER_AGENT_ID = 'agent-cluster' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;

const ITALIAN_GOAL = 'Il selettore di lingua deve vivere nelle impostazioni della sessione';
const ENGLISH_GOAL = 'The language picker belongs in the session settings';

const buildSession = (runGoal: string): Session =>
  buildStorySession({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: '',
    state: { kind: 'idle', lastActivityAt: NOW },
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
        goal: runGoal,
      },
    ],
  });

const buildWorkflow = ({
  goal = 'Consolidate the design system onto packages/ui',
} = {}): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'flow',
  description: '',
  goal,
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
});

const stepAgent: Agent = buildStoryAgent({
  id: STEP_AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  name: 'implement picker',
});

const clusterAgent: Agent = buildStoryAgent({
  id: CLUSTER_AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  parentAgentId: STEP_AGENT_ID,
  ordinal: 1,
  name: 'mechanical swaps onto existing primitives',
});

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

describe('sendTurn session language guard', () => {
  beforeEach(() => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.invokeAgentList.mockResolvedValue([stepAgent, clusterAgent] as never);
  });

  const setup = ({ runGoal, workflowGoal }: { runGoal: string; workflowGoal?: string }) => {
    useAppStore.setState({
      sessions: [buildSession(runGoal)],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: 'project-turn' as ProjectId,
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/turn',
          },
        ],
      },
      sessionPhaseRuns: { [SESSION_ID]: [stepAgent, clusterAgent] },
      selectedAgentId: { [SESSION_ID]: STEP_AGENT_ID },
      phaseTemplates: { [WORKSPACE_ID]: [buildWorkflow({ goal: workflowGoal })] },
      sessionLanguageAnchor: {},
      workspaces: [
        buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws', sessionsRoot: '/tmp' }),
      ],
      ...connectedAnthropicState(),
    });
  };

  const systemPromptFor = (): string =>
    String(
      (storySpies.runTurn.mock.calls[0]?.[0] as Record<string, unknown>)?.['systemPrompt'] ?? '',
    );

  it('pins an Italian run to Italian for the step agent', async () => {
    setup({ runGoal: ITALIAN_GOAL });
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain('[session-language]');
    expect(systemPrompt).toContain(ITALIAN_GOAL);
    expect(systemPrompt).toContain('Answer in the language that goal is written in');
  });

  it('pins an English run to English through the same rule', async () => {
    setup({ runGoal: ENGLISH_GOAL });
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain(ENGLISH_GOAL);
    expect(systemPrompt).not.toContain(ITALIAN_GOAL);
  });

  it('hands a sub-step the run goal rather than the context it was fanned out with', async () => {
    setup({ runGoal: ITALIAN_GOAL });
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: CLUSTER_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain(ITALIAN_GOAL);
    expect(systemPrompt).toContain(
      'whatever language the plan, the carried context, the step summaries, or your own tooling use',
    );
    expect(systemPrompt).not.toContain('Consolidate the design system onto packages/ui');
  });

  it('keeps the worktree scope guard alongside the language guard', async () => {
    setup({ runGoal: ITALIAN_GOAL });
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain('[worktree-scope]');
    expect(systemPrompt).toContain('[session-language]');
  });

  it('pins an operator turn to the capped latest message', async () => {
    setup({ runGoal: ITALIAN_GOAL });
    const content = `Messaggio recente ${'x'.repeat(300)}`;

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: STEP_AGENT_ID,
      content,
      origin: 'operator',
    });

    const anchor = useAppStore.getState().sessionLanguageAnchor[SESSION_ID];
    expect(anchor).toBe(content.slice(0, 280));
    expect(systemPromptFor()).toContain('The operator last wrote to this session:');
    expect(systemPromptFor()).toContain('Answer in the language that message is written in');
  });

  it('uses the message anchor for a later machine turn', async () => {
    setup({ runGoal: ITALIAN_GOAL });
    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: STEP_AGENT_ID,
      content: 'Scrivi il riepilogo',
      origin: 'operator',
    });
    storySpies.runTurn.mockClear();

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'machine continuation' });

    expect(systemPromptFor()).toContain('Scrivi il riepilogo');
    expect(systemPromptFor()).toContain('Answer in the language that message is written in');
  });

  it('omits the guard for a machine turn with no goal or message anchor', async () => {
    setup({ runGoal: '', workflowGoal: '' });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'machine continuation' });

    expect(systemPromptFor()).not.toContain('[session-language]');
  });

  it('keeps the guard with a blank goal when a message anchor exists', async () => {
    setup({ runGoal: '', workflowGoal: '' });
    useAppStore.setState({ sessionLanguageAnchor: { [SESSION_ID]: 'Continua in italiano' } });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'machine continuation' });

    expect(systemPromptFor()).toContain('[session-language]');
    expect(systemPromptFor()).toContain('Continua in italiano');
  });
});
