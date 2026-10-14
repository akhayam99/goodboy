import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertAgent,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
} from '@goodboy/db';
import type {
  AgentId,
  ProviderRunId,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import type { AgentInsertArgs } from '../features/workflows/workflows';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { cancelTurnStartWindow, ensureTurnStartWindow } from './slices/turn/turnStartWindow';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  STORY_NOW,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => {
  const actual =
    await vi.importActual<typeof import('../features/chat/turn')>('../features/chat/turn');
  return {
    ...(await import('./storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
    decodeCliTooOldMessage: actual.decodeCliTooOldMessage,
  };
});
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

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const WORKFLOW_ID = 'workflow-queue-delivery' as WorkflowId;
const AT = '2026-10-05T11:55:00.000Z' as TurnEvent['at'];
const QUEUED_TEXT = 'Send the Northwind totals';

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Settle batches through ledger-core',
  description: '',
  steps: [
    {
      id: 'step-queue-0' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Plan',
      role: 'planner',
      promptPrefix: 'Plan the batch settlement in ledger-core',
    },
  ],
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;
let isResolveFailing = false;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = { readonly runId: ProviderRunId };

const replyWith = (text: string) => {
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield { kind: 'assistant_text', runId, delta: text, at: AT };
    })(),
  );
};

beforeEach(async () => {
  isResolveFailing = false;
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
  for (const step of template.steps) {
    await db.execute(
      'INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES (?, ?, ?, ?, ?)',
      [step.id, WORKFLOW_ID, step.ordinal, step.name, step.promptPrefix],
    );
  }
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  storySpies.invokeAgentInsert.mockImplementation((run: AgentInsertArgs) =>
    insertAgent(storySqlite(), run),
  );
  storySpies.invokeAgentList.mockImplementation(async (id: unknown) => [
    ...((await listAgentsForSessions(storySqlite(), [id as SessionId])).get(id as SessionId) ?? []),
  ]);
  storySpies.invokeAgentUpdateStatus.mockImplementation((id: AgentId, fields) => {
    if (isResolveFailing && fields.providerRunId !== undefined) {
      return Promise.reject(new Error('agent row is locked'));
    }
    return recordAgentStatus(storySqlite(), id, fields);
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Settle batches through ledger-core',
  });
  sessionId = session.id as SessionId;
  await useAppStore
    .getState()
    .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: false, triggerMode: 'manual' });
  const plan = (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.name === 'Plan',
  );
  if (plan === undefined) {
    throw new Error('the workflow left no Plan agent');
  }
  agentId = plan.id;
  replyWith('Plan ready.');
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const queueItem = {
  id: 'queued-1',
  content: QUEUED_TEXT,
  attachments: [],
  override: undefined,
} as const;

const enqueue = () =>
  useAppStore.getState().enqueueAgentMessage({ turn: { ...queueItem, agentId } });

const drain = () => useAppStore.getState().drainAgentQueue({ sessionId, agentId });

const savedQueue = async () =>
  (
    await rowsOf<{ id: string }>({
      sql: 'SELECT id FROM agent_queued_messages WHERE agent_id = ?',
      params: [agentId],
    })
  ).map((row) => row.id);

const heldQueue = () =>
  (useAppStore.getState().agentQueue[agentId] ?? []).map((item) => [item.id, item.status]);

describe('a queued message on the real store', () => {
  it('leaves the queue once the provider turn started, exactly once', async () => {
    await enqueue();
    expect(await savedQueue()).toEqual(['queued-1']);

    await drain();

    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(1));
    expect(heldQueue()).toEqual([]);
    expect(await savedQueue()).toEqual([]);
  });

  it('stays queued and saved when the start was cancelled before the provider ran', async () => {
    await enqueue();
    ensureTurnStartWindow({ agentId });
    cancelTurnStartWindow({ agentId });

    await drain();

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(heldQueue()).toEqual([['queued-1', 'queued']]);
    expect(await savedQueue()).toEqual(['queued-1']);
  });

  it('stays queued and saved when the step agent could not be resolved', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await enqueue();
    isResolveFailing = true;

    await drain();

    expect(logged).toHaveBeenCalledWith('resolvePhaseAgent failed', expect.any(Error));
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(heldQueue()).toEqual([['queued-1', 'queued']]);
    expect(await savedQueue()).toEqual(['queued-1']);
  });
});
