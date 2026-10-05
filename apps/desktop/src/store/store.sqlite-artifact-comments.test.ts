import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertPlan } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  ArtifactCommentAnchor,
  ArtifactId,
  ImplementationCluster,
  IsoDateTime,
  PlanId,
  ProviderRunId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import type { SendTurnInput, SendTurnResult } from './slices/turn/types';

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
const SESSION_ID = 'session-payments' as SessionId;
const PLANNER_ID = 'agent-planner' as AgentId;
const PLAN_ID = 'plan-export' as PlanId;
const RUN_ID = 'run-export' as WorkflowRunId;
const PLAN_STEP_ID = 'step-plan' as StepId;
const IMPLEMENT_STEP_ID = 'step-implement' as StepId;
const TITLE = 'Dedupe on the event id';
const BODY = [
  '## Goal',
  '',
  'Stop the duplicate credit by checking the event id inside the transaction.',
  '',
  '## Rollout',
  '',
  'Ship behind a flag and backfill after a week.',
].join('\n');

const CLUSTERS: ReadonlyArray<ImplementationCluster> = [
  {
    title: 'Add the idempotency key',
    instructions: 'Add a unique index on event_id.',
    doneWhen: ['The index exists'],
    touches: ['db/migrations'],
  },
  {
    title: 'Check inside the transaction',
    instructions: 'Move the check after BEGIN.',
    doneWhen: ['No duplicate on replay'],
    touches: ['payments-api/credit.ts'],
  },
  {
    title: 'Backfill the ledger',
    instructions: 'Backfill every event.',
    doneWhen: ['Ledger totals match'],
    touches: ['ledger-core/backfill.ts'],
  },
];

const GOAL_BLOCK: ArtifactCommentAnchor = {
  kind: 'block',
  order: 0,
  text: 'Stop the duplicate credit by checking the event id inside the transaction.',
};

const part = ({ index }: { readonly index: number }): ArtifactCommentAnchor => ({
  kind: 'part',
  index,
  title: CLUSTERS[index]?.title ?? '',
});

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: 'workflow-ship' as WorkflowId,
  ordinal: 1,
  currentStep: 0,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'static',
  ...overrides,
});

const planner = (overrides: Partial<Agent> = {}): Agent =>
  buildStoryAgent({
    id: PLANNER_ID,
    sessionId: SESSION_ID,
    name: 'Planner',
    ordinal: 0,
    status: 'completed',
    ...overrides,
  });

let useAppStore: StoryStore;

const savePlan = async ({
  bodyMd,
  clusters,
  turn,
}: {
  readonly bodyMd: string;
  readonly clusters: ReadonlyArray<ImplementationCluster>;
  readonly turn: string;
}) =>
  upsertPlan(storySqlite(), {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_ID,
    title: TITLE,
    bodyMd,
    clusters,
    sourceTurnId: turn,
  });

const loadAll = async () => {
  await useAppStore.getState().loadSessionArtifacts(SESSION_ID);
  await useAppStore.getState().loadSessionPlans(SESSION_ID);
  await useAppStore.getState().loadArtifactComments({ sessionId: SESSION_ID });
};

const planOf = () => {
  const plan = useAppStore.getState().sessionPlans[SESSION_ID]?.find((p) => p.id === PLAN_ID);
  if (plan === undefined) {
    throw new Error('the plan is not loaded');
  }
  return plan;
};

const revisionOf = () =>
  useAppStore.getState().sessionArtifacts[SESSION_ID]?.find((a) => a.id === PLAN_ID)?.revision ?? 0;

const add = async ({
  anchor,
  body,
}: {
  readonly anchor: ArtifactCommentAnchor;
  readonly body: string;
}) =>
  useAppStore.getState().addArtifactComment({
    sessionId: SESSION_ID,
    artifactId: PLAN_ID as ArtifactId,
    revision: revisionOf(),
    anchor,
    body,
  });

const comments = () => useAppStore.getState().artifactComments[SESSION_ID] ?? [];

const statuses = () => comments().map((comment) => `${comment.body}:${comment.status}`);

const stubSendTurn = ({
  onSend,
}: {
  readonly onSend?: (content: string) => Promise<void>;
} = {}) => {
  const sendTurn = vi.fn(async (input: SendTurnInput): Promise<SendTurnResult> => {
    useAppStore.setState({
      transcripts: {
        [PLANNER_ID]: [
          {
            kind: 'user_text',
            runId: 'run-v2' as ProviderRunId,
            text: input.content,
            at: new Date().toISOString() as IsoDateTime,
          },
        ],
      },
    });
    await onSend?.(input.content);
    return { blockedOverBudget: false };
  });
  useAppStore.setState({ sendTurn });
  return sendTurn;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ artifact_mirror_remove: true });
  const db = await openStorySqlite();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, 'Harborline', 'harborline', 1, 1)",
    [WORKSPACE_ID],
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, 'Goal', 'idle', 1, 1)",
    [SESSION_ID, WORKSPACE_ID],
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 0, 'Planner', 'completed')",
    [PLANNER_ID, SESSION_ID],
  );
  await savePlan({ bodyMd: BODY, clusters: CLUSTERS, turn: 'run-v1' });
  useAppStore.setState({
    workspaces: [harborline],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionPhaseRuns: { [SESSION_ID]: [planner()] },
  });
  await loadAll();
});

describe('store on sqlite: plan comments', () => {
  it('keeps drafts across a reload and lets one be edited', async () => {
    const id = await add({ anchor: part({ index: 2 }), body: '  Split this one  ' });
    expect(id).not.toBeNull();
    await useAppStore
      .getState()
      .editArtifactComment({ sessionId: SESSION_ID, commentId: id ?? '', body: 'Split in two' });
    useAppStore.setState({ artifactComments: {} });
    await useAppStore.getState().loadArtifactComments({ sessionId: SESSION_ID });
    expect(statuses()).toEqual(['Split in two:draft']);
    expect(comments()[0]).toMatchObject({ revision: 1, anchor: part({ index: 2 }) });
  });

  it('ignores a blank comment', async () => {
    await expect(add({ anchor: GOAL_BLOCK, body: '   ' })).resolves.toBeNull();
    expect(comments()).toEqual([]);
  });

  it('sends one turn to the planner with the comments in document order', async () => {
    await add({ anchor: part({ index: 2 }), body: 'Limit the backfill to 90 days' });
    await add({
      anchor: {
        kind: 'quote',
        order: 0,
        text: 'event id',
        blockText: GOAL_BLOCK.kind === 'block' ? GOAL_BLOCK.text : '',
      },
      body: 'Say which event id',
    });
    await add({ anchor: part({ index: 0 }), body: 'Name the index' });
    const sendTurn = stubSendTurn();

    const result = await useAppStore
      .getState()
      .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });

    expect(result).toEqual({ kind: 'unchanged' });
    expect(sendTurn).toHaveBeenCalledTimes(1);
    const input = sendTurn.mock.calls[0]?.[0];
    expect(input).toMatchObject({ sessionId: SESSION_ID, agentId: PLANNER_ID });
    expect(input?.origin).toBeUndefined();
    const content = input?.content ?? '';
    expect(content.startsWith('Please revise the plan:')).toBe(true);
    const heads = [
      'On the goal:',
      'On part 1 "Add the idempotency key":',
      'On part 3 "Backfill the ledger":',
    ];
    const positions = heads.map((head) => content.indexOf(head));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(content).toContain('> event id');
    expect(content).toContain('> Done when: Ledger totals match');
    expect(content).toContain('Limit the backfill to 90 days');
    expect(content.trimEnd().endsWith('did not touch.')).toBe(true);
  });

  it('marks changed parts addressed and the others open once the new version lands', async () => {
    await add({ anchor: part({ index: 2 }), body: 'Limit the backfill' });
    await add({ anchor: part({ index: 0 }), body: 'Name the index' });
    await add({ anchor: GOAL_BLOCK, body: 'Cite the ticket' });
    const before = revisionOf();
    stubSendTurn({
      onSend: async () => {
        await savePlan({
          bodyMd: BODY,
          clusters: [
            CLUSTERS[0] as ImplementationCluster,
            CLUSTERS[1] as ImplementationCluster,
            { ...(CLUSTERS[2] as ImplementationCluster), instructions: 'Backfill 90 days only.' },
          ],
          turn: 'run-v2',
        });
      },
    });

    const result = await useAppStore
      .getState()
      .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });

    expect(result).toEqual({ kind: 'revised', revision: before + 1, addressed: 1, open: 2 });
    expect(statuses()).toEqual([
      'Limit the backfill:addressed',
      'Name the index:open',
      'Cite the ticket:open',
    ]);
    expect(comments().every((comment) => comment.sentTurnId === 'run-v2')).toBe(true);
    const [note] = await rowsOf<{ author: string; ask: string; pinned_json: string }>({
      sql: `SELECT author, ask, pinned_json FROM artifact_revisions WHERE artifact_id = '${PLAN_ID}' AND revision = ${before + 1}`,
    });
    expect(note?.author).toBe('agent');
    expect(note?.ask).toContain('Limit the backfill');
    expect(note?.pinned_json).toContain('part:3');
    expect(useAppStore.getState().artifactCommentSends[PLAN_ID]).toBeUndefined();
  });

  it('marks a quoted sentence addressed when the planner rewrote it', async () => {
    await add({
      anchor: { kind: 'quote', order: 0, text: 'checking the event id', blockText: 'x' },
      body: 'Which transaction?',
    });
    stubSendTurn({
      onSend: async () => {
        await savePlan({
          bodyMd: BODY.replace('checking the event id', 'a unique index on the event id'),
          clusters: CLUSTERS,
          turn: 'run-v2',
        });
      },
    });
    await useAppStore.getState().sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
    expect(statuses()).toEqual(['Which transaction?:addressed']);
  });

  it('puts the comments back to open when the turn writes no new version', async () => {
    await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
    stubSendTurn();
    const result = await useAppStore
      .getState()
      .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
    expect(result).toEqual({ kind: 'unchanged' });
    expect(statuses()).toEqual(['Why after BEGIN?:open']);
    expect(comments()[0]?.revision).toBe(revisionOf());
  });

  it('returns the comments to drafts when the turn does not start', async () => {
    await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
    useAppStore.setState({
      sendTurn: vi.fn(async (): Promise<SendTurnResult> => {
        throw new Error('provider offline');
      }),
    });
    const result = await useAppStore
      .getState()
      .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
    expect(result).toMatchObject({ kind: 'failed' });
    expect(statuses()).toEqual(['Why after BEGIN?:draft']);
    expect(useAppStore.getState().artifactCommentSends[PLAN_ID]).toBeUndefined();
  });

  it('returns the comments to drafts when the session budget blocks the turn', async () => {
    await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
    useAppStore.setState({
      sendTurn: vi.fn(async (): Promise<SendTurnResult> => ({ blockedOverBudget: true })),
    });
    const result = await useAppStore
      .getState()
      .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
    expect(result).toMatchObject({ kind: 'failed' });
    expect(statuses()).toEqual(['Why after BEGIN?:draft']);
  });

  it('sends nothing when there is no draft', async () => {
    const sendTurn = stubSendTurn();
    await expect(
      useAppStore.getState().sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() }),
    ).resolves.toEqual({ kind: 'empty' });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('refuses a second send while one is in flight', async () => {
    await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sendTurn = stubSendTurn({ onSend: () => gate });
    const first = useAppStore
      .getState()
      .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
    await vi.waitFor(() => expect(sendTurn).toHaveBeenCalled());
    expect(statuses()).toEqual(['Why after BEGIN?:sent']);
    await expect(
      useAppStore.getState().sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() }),
    ).resolves.toEqual({ kind: 'busy' });
    release();
    await first;
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  describe('guards', () => {
    const blockedBy = async () => {
      await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
      const sendTurn = stubSendTurn();
      const result = await useAppStore
        .getState()
        .sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
      expect(sendTurn).not.toHaveBeenCalled();
      expect(statuses()).toEqual(['Why after BEGIN?:draft']);
      return result;
    };

    it('refuses when the planner is gone', async () => {
      useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [] } });
      expect(await blockedBy()).toEqual({
        kind: 'blocked',
        reason: 'The planner is gone, so comments cannot be sent.',
      });
    });

    it('refuses when the plan already ran', async () => {
      await storySqlite().execute(
        `INSERT INTO plan_consumptions (id, plan_id, artifact_kind, agent_id, consumed_at)
         VALUES ('consumption-1', ?, 'plan', ?, 1)`,
        [PLAN_ID, PLANNER_ID],
      );
      await storySqlite().execute("UPDATE session_artifacts SET status = 'consumed' WHERE id = ?", [
        PLAN_ID,
      ]);
      await loadAll();
      expect(await blockedBy()).toEqual({
        kind: 'blocked',
        reason: 'This plan already ran. Comments cannot change it.',
      });
    });

    it('refuses when the next workflow step already started', async () => {
      useAppStore.setState({
        sessions: [
          buildStorySession({
            id: SESSION_ID,
            workspaceId: WORKSPACE_ID,
            workflowRuns: [run()],
          }),
        ],
        sessionPhaseRuns: {
          [SESSION_ID]: [
            planner({ stepId: PLAN_STEP_ID, workflowRunId: RUN_ID }),
            buildStoryAgent({
              id: 'agent-implementer' as AgentId,
              sessionId: SESSION_ID,
              name: 'Implementer',
              ordinal: 1,
              status: 'running',
              stepId: IMPLEMENT_STEP_ID,
              workflowRunId: RUN_ID,
            }),
          ],
        },
      });
      expect(await blockedBy()).toEqual({
        kind: 'blocked',
        reason: 'The next step (Implementer) already started. Comments cannot change the plan.',
      });
    });

    it('sends while the next workflow step has not started', async () => {
      useAppStore.setState({
        sessions: [
          buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, workflowRuns: [run()] }),
        ],
        sessionPhaseRuns: {
          [SESSION_ID]: [
            planner({ stepId: PLAN_STEP_ID, workflowRunId: RUN_ID }),
            buildStoryAgent({
              id: 'agent-implementer' as AgentId,
              sessionId: SESSION_ID,
              name: 'Implementer',
              ordinal: 1,
              status: 'pending',
              stepId: IMPLEMENT_STEP_ID,
              workflowRunId: RUN_ID,
            }),
          ],
        },
      });
      await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
      const sendTurn = stubSendTurn();
      await useAppStore.getState().sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
      expect(sendTurn).toHaveBeenCalledTimes(1);
    });

    it('sends while the run is held for plan approval even if a later step shows as started', async () => {
      useAppStore.setState({
        sessions: [
          buildStorySession({
            id: SESSION_ID,
            workspaceId: WORKSPACE_ID,
            workflowRuns: [
              run({ orchestrationStop: { kind: 'plan-approval', message: 'Approve the plan.' } }),
            ],
          }),
        ],
        sessionPhaseRuns: {
          [SESSION_ID]: [
            planner({ stepId: PLAN_STEP_ID, workflowRunId: RUN_ID }),
            buildStoryAgent({
              id: 'agent-implementer' as AgentId,
              sessionId: SESSION_ID,
              name: 'Implementer',
              ordinal: 1,
              status: 'running',
              stepId: IMPLEMENT_STEP_ID,
              workflowRunId: RUN_ID,
            }),
          ],
        },
      });
      await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
      const sendTurn = stubSendTurn();
      await useAppStore.getState().sendArtifactComments({ sessionId: SESSION_ID, plan: planOf() });
      expect(sendTurn).toHaveBeenCalledTimes(1);
    });
  });

  it('removes a draft and brings it back with Undo', async () => {
    const id = await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
    const before = comments()[0];
    await expect(
      useAppStore.getState().removeArtifactComment({ sessionId: SESSION_ID, commentId: id ?? '' }),
    ).resolves.toBe(true);
    expect(comments()).toEqual([]);

    await expect(useAppStore.getState().undoLastOperation({ shouldAnnounce: false })).resolves.toBe(
      true,
    );

    expect(comments()).toHaveLength(1);
    expect(comments()[0]).toMatchObject({
      id: before?.id,
      body: before?.body,
      anchor: before?.anchor,
      status: 'draft',
      createdAt: before?.createdAt,
    });
  });

  it('keeps a sent comment when asked to remove it', async () => {
    const id = await add({ anchor: part({ index: 1 }), body: 'Why after BEGIN?' });
    await storySqlite().execute("UPDATE artifact_comments SET status = 'sent' WHERE id = ?", [id]);
    await useAppStore.getState().loadArtifactComments({ sessionId: SESSION_ID });
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [planner({ status: 'running' })] } });
    await expect(
      useAppStore.getState().removeArtifactComment({ sessionId: SESSION_ID, commentId: id ?? '' }),
    ).resolves.toBe(false);
    expect(comments()).toHaveLength(1);
  });

  it('settles comments left as sent by a closed app once the planner is idle', async () => {
    await add({ anchor: part({ index: 2 }), body: 'Limit the backfill' });
    await add({ anchor: part({ index: 0 }), body: 'Name the index' });
    await storySqlite().execute("UPDATE artifact_comments SET status = 'sent'");
    await savePlan({
      bodyMd: BODY,
      clusters: [
        CLUSTERS[0] as ImplementationCluster,
        CLUSTERS[1] as ImplementationCluster,
        { ...(CLUSTERS[2] as ImplementationCluster), instructions: 'Backfill 90 days only.' },
      ],
      turn: 'run-v2',
    });
    await loadAll();
    expect(statuses().sort()).toEqual(['Limit the backfill:addressed', 'Name the index:open']);
  });

  it('leaves sent comments alone while the planner still runs', async () => {
    await add({ anchor: part({ index: 2 }), body: 'Limit the backfill' });
    await storySqlite().execute("UPDATE artifact_comments SET status = 'sent'");
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [planner({ status: 'running' })] } });
    await useAppStore.getState().loadArtifactComments({ sessionId: SESSION_ID });
    expect(statuses()).toEqual(['Limit the backfill:sent']);
  });
});
