import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  TaskId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@kay-am/types';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before subject import
// ---------------------------------------------------------------------------

vi.mock('../turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertTask: vi.fn(),
  insertTaskWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForTask: vi.fn(async () => []),
  listMessagesForTask: vi.fn(async () => []),
  listTasksForWorkspace: vi.fn(async () => []),
  listTelemetryForTask: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => [
    { id: 'ws-1', name: 'ws', rootPath: '/tmp', createdAt: '', updatedAt: '' },
  ]),
  setSetting: vi.fn(),
  summarizeTaskTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateTaskState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
}));

vi.mock('../providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../routing', () => ({ resolveProviderForTurn: vi.fn() }));

vi.mock('../budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

const phaseRunInsertSpy = vi.fn();
const phaseRunListSpy = vi.fn();

vi.mock('../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: (sid: TaskId) => phaseRunListSpy(sid),
  invokePhaseRunInsert: (args: unknown) => phaseRunInsertSpy(args),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../worktree', () => ({
  createWorktree: vi.fn(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'kay/test',
    slug: 'test',
  })),
  removeWorktree: vi.fn(),
}));

vi.mock('../repo', () => ({ validateGitRepo: vi.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WS_ID = 'ws-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-refactor' as WorkflowId;
const NOW = '2026-05-10T00:00:00.000Z' as IsoDateTime;

function makeRefactorWorkflow(): Workflow {
  return {
    id: WORKFLOW_ID,
    workspaceId: WS_ID,
    name: 'Refactor',
    description: 'scout/plan/refactor/verify',
    steps: [
      {
        id: 's-scout' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        name: 'Scout',
        promptPrefix: '',
      },
      {
        id: 's-plan' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 1,
        name: 'Plan',
        promptPrefix: '',
      },
      {
        id: 's-refactor' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 2,
        name: 'Refactor',
        promptPrefix: '',
      },
      {
        id: 's-verify' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 3,
        name: 'Verify',
        promptPrefix: '',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

let inserted: Session[] = [];

function wirePhaseSpies() {
  inserted = [];
  phaseRunInsertSpy.mockReset();
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const row: Session = {
      id: `ses-${inserted.length + 1}` as SessionId,
      taskId: args['taskId'] as TaskId,
      ordinal: args['ordinal'] as number,
      name: args['name'] as string,
      status: 'pending',
      ...((args['stepId'] as StepId | undefined) !== undefined && {
        stepId: args['stepId'] as StepId,
      }),
    };
    inserted.push(row);
    return row;
  });
  phaseRunListSpy.mockReset();
  phaseRunListSpy.mockImplementation(async () => inserted);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSession — workflow stepper seeding (#424)', () => {
  beforeEach(() => {
    wirePhaseSpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seeds exactly one agent for the first workflow step (no redundant default agent)', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'extract helpers',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(1);
    const args = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args['stepId']).toBe('s-scout');
    expect(args['name']).toBe('Scout');
    expect(args['ordinal']).toBe(0);

    const state = useAppStore.getState();
    const sid = state.currentSessionId as TaskId;
    expect(state.sessionPhaseRuns[sid]?.length).toBe(1);
  });

  it('falls back to a single generic "agent 1" when no workflow is attached', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'free form',
      branchPrefix: 'kay',
    });

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(1);
    const args = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args['name']).toBe('agent 1');
    expect(args['stepId']).toBeUndefined();
  });

  it('spawnAgent advances to the next workflow step after the first completes', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'refactor X',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    inserted = inserted.map((r) =>
      r.stepId === ('s-scout' as StepId) ? { ...r, status: 'completed' as const } : r,
    );

    await useAppStore.getState().spawnAgent(session.id, { stepId: 's-plan' as StepId });

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(2);
    const second = phaseRunInsertSpy.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(second['stepId']).toBe('s-plan');
    expect(second['name']).toBe('Plan');

    const state = useAppStore.getState();
    expect(state.sessionPhaseRuns[session.id]?.length).toBe(2);
  });
});
