import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  emptyTurnStream,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import {
  brandId,
  type Agent,
  type AgentId,
  type AgentRole,
  type ProjectId,
  type ProviderId,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import type { AgentInsertArgs, AgentUpdateFields } from '../features/workflows/workflows';
import { resolveProviderForTurn } from '../features/providers/routing';

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

const WS_ID = brandId<WorkspaceId>({ value: 'ws-northwind' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'wf-all-roles' });

const STEP_ROLES: ReadonlyArray<AgentRole> = [
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'investigator',
  'tester',
  'docs',
];

const PROVIDERS: ReadonlyArray<RouteParams> = [
  { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { provider: 'codex', model: 'gpt-5.6-terra' },
  { provider: 'cursor', model: 'gpt-5.6-sol-high' },
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'copilot', model: 'gpt-5.6-terra' },
  { provider: 'opencode', model: 'opencode/gpt-5.6-terra' },
];

type StepSpec = {
  readonly name: string;
  readonly role: AgentRole;
};

const STEP_SPECS: ReadonlyArray<StepSpec> = [
  { name: 'warmup', role: 'scout' },
  ...STEP_ROLES.map((role) => ({ name: role, role })),
];

const allRolesWorkflow = (): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WS_ID,
  name: 'Every role',
  description: 'one step per role',
  steps: STEP_SPECS.map(({ name, role }, ordinal) => ({
    id: brandId<StepId>({ value: `step-${name}` }),
    workflowId: WORKFLOW_ID,
    ordinal,
    name: `Step ${name}`,
    promptPrefix: `Do the ${name} part for Northwind.`,
    role,
  })),
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

let inserted: Agent[] = [];
let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const wireSpies = () => {
  storySpies.getWorkspaceById.mockImplementation(async ({ id }) =>
    buildStoryWorkspace({ id, name: 'Northwind', slug: 'northwind' }),
  );
  storySpies.listProjectsForWorkspace.mockImplementation(async ({ workspaceId }) => [
    buildStoryProject({
      id: brandId<ProjectId>({ value: 'project-1' }),
      workspaceId,
      name: 'ledger-core',
      rootPath: '/tmp',
    }),
  ]);
  storySpies.listWorkspaces.mockImplementation(async () => [
    buildStoryWorkspace({ id: WS_ID, name: 'Northwind' }),
  ]);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'nw/settle',
    slug: 'settle',
  }));
  storySpies.scratchDirPrepare.mockImplementation(
    async () => '/tmp/goodboy-root/scratch/mountless',
  );
  inserted = [];
  storySpies.invokeAgentInsert.mockImplementation(async (args: AgentInsertArgs) => {
    const row: Agent = {
      id: brandId<AgentId>({ value: `agent-${inserted.length + 1}` }),
      sessionId: args.sessionId,
      ordinal: args.ordinal,
      name: args.name,
      status: args.status ?? 'pending',
      ...(args.stepId !== undefined && { stepId: args.stepId }),
      ...(args.workflowRunId !== undefined && { workflowRunId: args.workflowRunId }),
    };
    inserted.push(row);
    return row;
  });
  storySpies.invokeAgentList.mockImplementation(async () => inserted);
  storySpies.invokeAgentUpdateStatus.mockImplementation(
    async (id: AgentId, fields: AgentUpdateFields) => {
      const existing = inserted.find((row) => row.id === id);
      if (existing === undefined) {
        throw new Error(`no agent ${id}`);
      }
      const updated: Agent = { ...existing, status: fields.status };
      inserted = inserted.map((row) => (row.id === id ? updated : row));
      return updated;
    },
  );
};

type RouteParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

const routeTo = async ({ provider, model }: RouteParams) => {
  vi.mocked(resolveProviderForTurn).mockResolvedValue({
    selectedProvider: provider,
    selectedModel: model,
    reason: 'preferred',
    fallbackUsed: false,
  });
};

type TextOfParams = {
  readonly value: unknown;
  readonly key: string;
};

const textOf = ({ value, key }: TextOfParams): string => {
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const found: unknown = Reflect.get(value, key);
  return typeof found === 'string' ? found : '';
};

type Sent = {
  readonly agentId: AgentId;
  readonly role: AgentRole;
  readonly prompt: string;
  readonly systemPrompt: string;
};

const startEveryRole = async ({ provider, model }: RouteParams): Promise<ReadonlyArray<Sent>> => {
  await routeTo({ provider, model });
  useAppStore.setState({
    currentWorkspaceId: WS_ID,
    phaseTemplates: { [WS_ID]: [allRolesWorkflow()] },
    agentRunHistory: {},
    transcripts: {},
    agentHandoffs: {},
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WS_ID,
    goal: 'Settlement totals are off by a few cents per batch',
    branchPrefix: 'nw',
    workflowId: WORKFLOW_ID,
  });
  await vi.waitFor(() => expect(inserted.length).toBe(STEP_ROLES.length + 1));
  await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(1));
  const sent: Sent[] = [];
  storySpies.runTurn.mockClear();
  useAppStore.setState((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: inserted },
  }));
  for (const role of STEP_ROLES) {
    const agent = inserted.find((row) => row.stepId === `step-${role}`);
    if (agent === undefined) {
      throw new Error(`no agent for ${role}`);
    }
    const before = storySpies.runTurn.mock.calls.length;
    await useAppStore
      .getState()
      .activateWorkflowAgent({ sessionId: session.id, agentId: agent.id, bypassGate: true });
    await vi.waitFor(() => expect(storySpies.runTurn.mock.calls.length).toBeGreaterThan(before));
    const args: unknown = storySpies.runTurn.mock.calls.at(-1)?.[0];
    sent.push({
      agentId: agent.id,
      role,
      prompt: textOf({ value: args, key: 'prompt' }),
      systemPrompt: textOf({ value: args, key: 'systemPrompt' }),
    });
  }
  return sent;
};

describe('every provider and role kickoff asks for the markers the harness reads', () => {
  beforeEach(() => {
    resetStorySpies();
    wireSpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  });

  for (const route of PROVIDERS) {
    it(`${route.provider}: step-done with its own id, the question block and the context protocol`, async () => {
      const sent = await startEveryRole(route);

      expect(sent).toHaveLength(STEP_ROLES.length);
      for (const turn of sent) {
        const everything = `${turn.systemPrompt}\n${turn.prompt}`;
        expect(everything, `${route.provider} ${turn.role} step-done`).toContain(
          `<<step-done id="${turn.agentId}">>`,
        );
        expect(everything, `${route.provider} ${turn.role} question`).toContain('<<ctx-question');
        expect(everything, `${route.provider} ${turn.role} close`).toContain('<</ctx-question>>');
        expect(everything, `${route.provider} ${turn.role} decision`).toContain('<<ctx-decision>>');
        if (turn.role === 'planner') {
          expect(everything, `${route.provider} planner plan block`).toContain('<<plan>>');
          expect(everything, `${route.provider} planner plan close`).toContain('<</plan>>');
        }
        if (turn.role === 'scout') {
          expect(everything, `${route.provider} scout handoff`).toContain('<<handoff kind=');
        }
        expect(turn.prompt, `${route.provider} ${turn.role} in the message`).toContain(
          `<<step-done id="${turn.agentId}">>`,
        );
      }
    });
  }
});
