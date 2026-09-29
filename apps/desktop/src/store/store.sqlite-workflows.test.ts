import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { purgedAgentIds } from './session-mutators';
import { anAgent } from '@goodboy/types/testing';
import type {
  AgentId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  STORY_NOW,
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

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const WORKFLOW_ID = 'workflow-close-the-books' as WorkflowId;
const STEP_ID = 'step-reconcile' as StepId;
const REVIEW_STEP_ID = 'step-review' as StepId;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Close the books',
  description: 'Reconcile the Harborline ledger',
  steps: [
    {
      id: STEP_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Reconcile',
      promptPrefix: 'Reconcile the ledger export',
    },
    {
      id: REVIEW_STEP_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Review',
      promptPrefix: 'Review the reconciliation',
    },
  ],
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const startSession = async () => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Reconcile the Harborline ledger export',
  });
  return session.id as SessionId;
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 } });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
  await db.execute(
    "INSERT INTO steps (id, workflow_id, ordinal, name) VALUES (?, ?, 0, 'Reconcile'), (?, ?, 1, 'Review')",
    [STEP_ID, WORKFLOW_ID, REVIEW_STEP_ID, WORKFLOW_ID],
  );
  useAppStore.setState({
    activateWorkflowAgent: async () => undefined,
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [template] },
  });
});

const runRows = (sessionId: SessionId) =>
  rowsOf<{ workflow_run_id: string }>({
    sql: 'SELECT workflow_run_id FROM session_workflows WHERE session_id = ? ORDER BY ordinal',
    params: [sessionId],
  });

const storedRunIds = (sessionId: SessionId) =>
  useAppStore
    .getState()
    .sessions.find((session) => session.id === sessionId)
    ?.workflowRuns.map((run) => run.id) ?? [];

type AgentInsertInput = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId;
  readonly ordinal: number;
  readonly name: string;
};

const insertAgentLikeRust = async ({
  sessionId,
  workflowRunId,
  ordinal,
  name,
}: AgentInsertInput) => {
  const stepId = ordinal === 0 ? STEP_ID : REVIEW_STEP_ID;
  const agent = anAgent({
    id: `agent-${ordinal}` as AgentId,
    sessionId,
    stepId,
    ordinal,
    name,
    ...(workflowRunId === undefined ? {} : { workflowRunId }),
  });
  await storySqlite().execute(
    "INSERT INTO agents (id, session_id, step_id, ordinal, name, status, workflow_run_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
    [agent.id, sessionId, stepId, ordinal, name, workflowRunId ?? null],
  );
  return agent;
};

const agentRows = (sessionId: SessionId) =>
  rowsOf<{ id: string; deleted_at: number | null }>({
    sql: 'SELECT id, deleted_at FROM agents WHERE session_id = ?',
    params: [sessionId],
  });

describe('store on sqlite: attaching a workflow to a session', () => {
  it('writes the run row and the store run together', async () => {
    const sessionId = await startSession();
    storySpies.invokeAgentInsert.mockImplementation(insertAgentLikeRust);

    await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID);

    const rows = (await runRows(sessionId)).map((row) => row.workflow_run_id);
    expect(rows).toHaveLength(1);
    expect(storedRunIds(sessionId)).toEqual(rows);
    expect(useAppStore.getState().sessionPhaseRuns[sessionId]?.map((agent) => agent.name)).toEqual([
      'Reconcile',
      'Review',
    ]);
    expect((await agentRows(sessionId)).map((row) => row.deleted_at)).toEqual([null, null]);
  });

  it('leaves no run row behind when the agents cannot be created', async () => {
    const sessionId = await startSession();
    storySpies.invokeAgentInsert.mockRejectedValue(new Error('agent insert refused'));

    await expect(
      useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID),
    ).rejects.toThrow('agent insert refused');

    expect(await runRows(sessionId)).toEqual([]);
    expect(storedRunIds(sessionId)).toEqual([]);
  });

  it('purges the agents already created when a later one is refused', async () => {
    const sessionId = await startSession();
    storySpies.invokeAgentInsert
      .mockImplementationOnce(insertAgentLikeRust)
      .mockRejectedValueOnce(new Error('agent insert refused'));

    await expect(
      useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID),
    ).rejects.toThrow('agent insert refused');

    expect(await runRows(sessionId)).toEqual([]);
    const agents = await agentRows(sessionId);
    expect(agents.every((row) => row.deleted_at !== null)).toBe(true);
    expect(storedRunIds(sessionId)).toEqual([]);
  });
});

describe('store on sqlite: removing a workflow run from a session', () => {
  const attachRun = async () => {
    const sessionId = await startSession();
    storySpies.invokeAgentInsert.mockImplementation(insertAgentLikeRust);
    await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID);
    const runId = storedRunIds(sessionId)[0];
    if (runId === undefined) {
      throw new Error('the run was not attached');
    }
    return { sessionId, runId };
  };

  it('deletes the run row, purges its agents and drops the store run', async () => {
    const { sessionId, runId } = await attachRun();

    await useAppStore.getState().detachWorkflowFromSession(sessionId, runId);

    expect(await runRows(sessionId)).toEqual([]);
    expect((await agentRows(sessionId)).every((row) => row.deleted_at !== null)).toBe(true);
    expect(storedRunIds(sessionId)).toEqual([]);
  });

  it('keeps the run, its agents and the store run when the row delete fails', async () => {
    const { sessionId, runId } = await attachRun();
    injectDbFault({
      match: /DELETE FROM session_workflows WHERE workflow_run_id/,
      message: 'disk full',
    });

    await expect(
      useAppStore.getState().detachWorkflowFromSession(sessionId, runId),
    ).rejects.toThrow();

    expect((await runRows(sessionId)).map((row) => row.workflow_run_id)).toEqual([runId]);
    expect((await agentRows(sessionId)).map((row) => row.deleted_at)).toEqual([null, null]);
    expect(storedRunIds(sessionId)).toEqual([runId]);
    expect(purgedAgentIds.has('agent-0' as AgentId)).toBe(false);
  });
});
