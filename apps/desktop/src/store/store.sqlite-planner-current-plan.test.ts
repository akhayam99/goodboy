import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import type {
  AgentId,
  ArtifactId,
  PlanArtifact,
  ProviderRunId,
  SessionId,
  TurnEvent,
} from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
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
const PLAN_BODY = '# Backfill the settled batches\n\n## Goal\nEvery batch is settled once.\n';
const isArtifactId = (value: string): value is ArtifactId => value.length > 0;
const PLAN_ID_TEXT = 'plan-harborline';
if (!isArtifactId(PLAN_ID_TEXT)) {
  throw new Error('the plan id is empty');
}
const PLAN_ID = PLAN_ID_TEXT;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = { readonly runId: ProviderRunId };

const answer = (text: string) =>
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield { kind: 'assistant_text', runId, delta: text, at: TEST_NOW };
    })(),
  );

const planArtifact = ({
  sessionId,
  agentId,
  status,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly status: PlanArtifact['status'];
}): PlanArtifact => ({
  id: PLAN_ID,
  sessionId,
  agentId,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Backfill the settled batches',
  sourceFormat: 'markdown',
  sourceText: PLAN_BODY,
  metadata: {},
  status,
  revision: 2,
  sourceTurnId: null,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  openedAt: null,
});

const startAgent = async (kind: 'planner' | 'generic') => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: kind,
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  if (kind === 'planner') {
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(useAppStore.getState().agentTurnState[agent.id]?.kind).toBe('idle'),
    );
  }
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
  storySpies.runTurn.mockClear();
  return { sessionId: session.id, agentId: agent.id };
};

const seedPlan = ({
  sessionId,
  ownerId,
  status,
}: {
  readonly sessionId: SessionId;
  readonly ownerId: AgentId;
  readonly status: PlanArtifact['status'];
}) =>
  useAppStore.setState({
    sessionArtifacts: {
      [sessionId]: [planArtifact({ sessionId, agentId: ownerId, status })],
    },
  });

const send = ({
  sessionId,
  agentId,
  content,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly content: string;
}) => useAppStore.getState().sendTurn({ sessionId, agentId, content });

const promptSent = (): string => storySpies.runTurn.mock.calls[0]?.[0]?.prompt ?? '';

const notes = (agentId: AgentId) =>
  (useAppStore.getState().transcripts[agentId] ?? []).flatMap((event) =>
    event.kind === 'decision_note' ? [event.message] : [],
  );

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [],
    sessions: [],
    archivedSessions: {},
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
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  answer('Understood.');
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('the planner is given its current plan', () => {
  it('puts the id, the revision and the whole body above the message of a follow-up turn', async () => {
    const planner = await startAgent('planner');
    seedPlan({ sessionId: planner.sessionId, ownerId: planner.agentId, status: 'active' });

    await send({ ...planner, content: 'Add a rollback step before the migration' });

    const prompt = promptSent();
    expect(prompt).toContain(`[current-plan id="${PLAN_ID}" revision="2"]`);
    expect(prompt).toContain(PLAN_BODY.trim());
    expect(prompt.indexOf('[/current-plan]')).toBeLessThan(
      prompt.indexOf('Add a rollback step before the migration'),
    );
  });

  it('gives no plan layer to a planner that has not written a plan yet', async () => {
    const planner = await startAgent('planner');

    await send({ ...planner, content: 'Plan the Northwind backfill' });

    expect(promptSent()).not.toContain('[current-plan');
  });

  it('gives no plan layer once the plan ran', async () => {
    const planner = await startAgent('planner');
    seedPlan({ sessionId: planner.sessionId, ownerId: planner.agentId, status: 'consumed' });

    await send({ ...planner, content: 'Add a rollback step' });

    expect(promptSent()).not.toContain('[current-plan');
  });

  it('gives no plan layer to an agent that is not a planner', async () => {
    const worker = await startAgent('generic');
    seedPlan({ sessionId: worker.sessionId, ownerId: worker.agentId, status: 'active' });

    await send({ ...worker, content: 'Add a rollback step' });

    expect(promptSent()).not.toContain('[current-plan');
  });
});

describe('a change request the planner answers without a new plan', () => {
  it('adds the unchanged note to the transcript', async () => {
    const planner = await startAgent('planner');
    seedPlan({ sessionId: planner.sessionId, ownerId: planner.agentId, status: 'active' });
    answer('Sure, I would add a rollback step first.');

    await send({ ...planner, content: 'Add a rollback step before the migration' });

    expect(notes(planner.agentId)).toEqual([
      expect.stringContaining('The planner answered without changing the plan'),
    ]);
  });

  it('stays quiet for an ordinary question about the plan', async () => {
    const planner = await startAgent('planner');
    seedPlan({ sessionId: planner.sessionId, ownerId: planner.agentId, status: 'active' });
    answer('Because the export must be frozen first.');

    await send({ ...planner, content: 'Why is the freeze the first step?' });

    expect(notes(planner.agentId)).toEqual([]);
  });

  it('stays quiet when there is no plan to change', async () => {
    const planner = await startAgent('planner');
    answer('Here is what I would do.');

    await send({ ...planner, content: 'Add a rollback step before the migration' });

    expect(notes(planner.agentId)).toEqual([]);
  });
});
