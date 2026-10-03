import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkflow,
  insertAgent,
  insertWorkspace,
  listWorkflows,
  upsertWorkflow,
} from '@goodboy/db';
import { WORKFLOW_LIBRARY, WorkflowRestoreError, normalizeAgentRole } from '@goodboy/core';
import { purgedAgentIds } from './slices/sessions/sessionMutators';
import type { AgentInsertArgs } from '../features/workflows/workflows';
import type { AgentId, SessionId, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
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

const insertAgentThroughDb = (run: AgentInsertArgs) =>
  insertAgent(storySqlite(), { ...run, id: run.id ?? (`agent-${run.ordinal}` as AgentId) });

const agentRows = (sessionId: SessionId) =>
  rowsOf<{ id: string; deleted_at: number | null }>({
    sql: 'SELECT id, deleted_at FROM agents WHERE session_id = ?',
    params: [sessionId],
  });

describe('store on sqlite: attaching a workflow to a session', () => {
  it('writes the run row and the store run together', async () => {
    const sessionId = await startSession();
    storySpies.invokeAgentInsert.mockImplementation(insertAgentThroughDb);

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
      .mockImplementationOnce(insertAgentThroughDb)
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
    storySpies.invokeAgentInsert.mockImplementation(insertAgentThroughDb);
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

describe('store on sqlite: restoring built-in workflows', () => {
  it('runs the real restore through the store and reloads the preserved row', async () => {
    const entry = WORKFLOW_LIBRARY[0];
    if (entry === undefined) {
      throw new Error('the workflow library is empty');
    }
    const workflowId = `wf_seed_${entry.slug}_legacy-container` as WorkflowId;
    const stepIds = entry.steps.map(
      (_step, ordinal) => `step_seed_${entry.slug}_${ordinal}_legacy-container` as StepId,
    );
    await upsertWorkflow(storySqlite(), {
      id: workflowId,
      workspaceId: WORKSPACE_ID,
      name: `${entry.name} ledger-core`,
      description: entry.description,
      origin: 'library',
      isPreset: true,
      steps: entry.steps.map((step, ordinal) => ({
        id: `step_seed_${entry.slug}_${ordinal}_legacy-container` as StepId,
        workflowId,
        role: normalizeAgentRole({ role: step.role }),
        ordinal,
        name: step.name,
        promptPrefix: 'Edited prompt',
        expectedOutput: step.expectedOutput,
      })),
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW,
    });
    storySpies.invokeWorkflowList.mockImplementation(() =>
      listWorkflows(storySqlite(), WORKSPACE_ID),
    );

    await useAppStore.getState().resetWorkflows({
      workspaceId: WORKSPACE_ID,
      slugs: [entry.slug],
    });

    const stored = await getWorkflow(storySqlite(), workflowId);
    expect(stored?.name).toBe(entry.name);
    expect(stored?.steps.map((step) => step.id)).toEqual(stepIds);
    expect(useAppStore.getState().phaseTemplates[WORKSPACE_ID]?.[0]?.id).toBe(WORKFLOW_ID);
    expect(useAppStore.getState().phaseTemplates[WORKSPACE_ID]?.[1]?.id).toBe(workflowId);
  });

  it('reloads the workflows a partial restore already wrote before it refused', async () => {
    const [restored, refused] = WORKFLOW_LIBRARY;
    if (restored === undefined || refused === undefined) {
      throw new Error('the workflow library needs two entries');
    }
    await storySqlite().execute('UPDATE workflows SET name = ? WHERE id = ?', [
      refused.name,
      WORKFLOW_ID,
    ]);
    storySpies.invokeWorkflowList.mockImplementation(() =>
      listWorkflows(storySqlite(), WORKSPACE_ID),
    );

    const failure = await useAppStore
      .getState()
      .resetWorkflows({ workspaceId: WORKSPACE_ID, slugs: [restored.slug, refused.slug] })
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toMatchObject({ kind: 'name_taken' });
    expect(
      useAppStore.getState().phaseTemplates[WORKSPACE_ID]?.map((template) => template.name),
    ).toContain(restored.name);
  });

  it('keeps the typed refusal when a name is taken and leaves rows unchanged', async () => {
    const entry = WORKFLOW_LIBRARY[0];
    if (entry === undefined) {
      throw new Error('the workflow library is empty');
    }
    await storySqlite().execute('UPDATE workflows SET name = ? WHERE id = ?', [
      entry.name,
      WORKFLOW_ID,
    ]);

    const failure = await useAppStore
      .getState()
      .resetWorkflows({
        workspaceId: WORKSPACE_ID,
        slugs: [entry.slug],
      })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(WorkflowRestoreError);
    expect(failure).toMatchObject({ kind: 'name_taken' });

    expect(await rowsOf({ sql: 'SELECT id FROM workflows ORDER BY id' })).toEqual([
      { id: WORKFLOW_ID },
    ]);
  });
});
