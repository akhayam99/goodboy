import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  SessionId,
  WorkflowExecutionMode,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { purgeAgentForDelete } from './agent';
import {
  attachWorkflowToSession,
  deleteOrphanedWorkflowAgents,
  detachWorkflowFromSession,
  updateWorkflowOrder,
} from './session-workflow';

const workspaceId = 'ws-harborline' as WorkspaceId;
const sessionId = 'ses-ledger' as SessionId;
const workflowId = 'wf-ledger' as WorkflowId;
const otherWorkflowId = 'wf-notify' as WorkflowId;
const RUN = 'run-ledger' as WorkflowRunId;
const OTHER_RUN = 'run-notify' as WorkflowRunId;
const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;
const EARLIER_DELETE = 5;

type SeedAgent = {
  readonly id: string;
  readonly workflowRunId: WorkflowRunId | null;
  readonly parentAgentId?: string;
  readonly stepId?: string;
  readonly deletedAt?: number;
};

type Fixture = {
  readonly executionMode: WorkflowExecutionMode;
  readonly agents: ReadonlyArray<SeedAgent>;
  readonly owned: ReadonlyArray<string>;
};

const BYSTANDERS: ReadonlyArray<SeedAgent> = [
  { id: 'notify-step', workflowRunId: OTHER_RUN, stepId: 'step-notify' },
  { id: 'standalone', workflowRunId: null },
];

const FIXTURES: Readonly<Record<string, Fixture>> = {
  'a preset or custom run': {
    executionMode: 'static',
    agents: [
      { id: 'scout', workflowRunId: RUN, stepId: 'step-scout' },
      { id: 'builder', workflowRunId: RUN, stepId: 'step-build' },
      { id: 'reviewer', workflowRunId: RUN, stepId: 'step-review', deletedAt: EARLIER_DELETE },
    ],
    owned: ['scout', 'builder', 'reviewer'],
  },
  'an orchestrated run': {
    executionMode: 'dynamic',
    agents: [
      { id: 'orchestrator', workflowRunId: RUN },
      { id: 'spawned-implementer', workflowRunId: RUN },
      { id: 'spawned-tester', workflowRunId: RUN },
      { id: 'spawned-child', workflowRunId: null, parentAgentId: 'spawned-implementer' },
    ],
    owned: ['orchestrator', 'spawned-implementer', 'spawned-tester', 'spawned-child'],
  },
  'a run with fan-out and nested children': {
    executionMode: 'static',
    agents: [
      { id: 'cluster-step', workflowRunId: RUN, stepId: 'step-scout' },
      { id: 'fanout-a', workflowRunId: null, parentAgentId: 'cluster-step' },
      { id: 'fanout-b', workflowRunId: null, parentAgentId: 'cluster-step' },
      { id: 'nested', workflowRunId: null, parentAgentId: 'fanout-a' },
      { id: 'deep', workflowRunId: null, parentAgentId: 'nested', deletedAt: EARLIER_DELETE },
    ],
    owned: ['cluster-step', 'fanout-a', 'fanout-b', 'nested', 'deep'],
  },
};

const seed = async ({ fixture }: { readonly fixture: Fixture }): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Harborline', '/code/harborline', 1, 1],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'Fix ledger totals', 'idle', 1, 1],
  );
  for (const id of [workflowId, otherWorkflowId]) {
    await db.execute(
      'INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, workspaceId, id, '', 1, 1],
    );
  }
  await db.execute(
    `INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES
       ('step-scout', ?, 0, 'Scout', ''), ('step-build', ?, 1, 'Build', ''),
       ('step-review', ?, 2, 'Review', ''), ('step-notify', ?, 0, 'Notify', '')`,
    [workflowId, workflowId, workflowId, otherWorkflowId],
  );
  await attachWorkflowToSession({
    db,
    sessionId,
    workflowRunId: RUN,
    workflowId,
    autoRun: true,
    updatedAt: NOW,
    executionMode: fixture.executionMode,
  });
  await attachWorkflowToSession({
    db,
    sessionId,
    workflowRunId: OTHER_RUN,
    workflowId: otherWorkflowId,
    autoRun: true,
    updatedAt: NOW,
  });
  const agents = [...fixture.agents, ...BYSTANDERS];
  for (const [ordinal, agent] of agents.entries()) {
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id, step_id, output_summary, deleted_at)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
      [
        agent.id,
        sessionId,
        ordinal,
        agent.id,
        agent.workflowRunId,
        agent.parentAgentId ?? null,
        agent.stepId ?? null,
        agent.deletedAt === undefined ? `Summary of ${agent.id}` : null,
        agent.deletedAt ?? null,
      ],
    );
    await db.execute(
      `INSERT INTO messages (id, session_id, agent_id, role, content, created_at)
       VALUES (?, ?, ?, 'assistant', ?, ?)`,
      [`msg-${agent.id}`, sessionId, agent.id, `Reply from ${agent.id}`, ordinal],
    );
    await db.execute(
      `INSERT INTO turn_events (id, session_id, agent_id, payload, created_at)
       VALUES (?, ?, ?, '{"kind":"user_text","text":"go"}', ?)`,
      [`event-${agent.id}`, sessionId, agent.id, ordinal],
    );
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, status, created_at, created_by_agent_id)
       VALUES (?, ?, ?, 'open', ?, ?), (?, ?, ?, 'answered', ?, ?)`,
      [
        `q-open-${agent.id}`,
        sessionId,
        `Which ledger for ${agent.id}?`,
        ordinal,
        agent.id,
        `q-answered-${agent.id}`,
        sessionId,
        `Which branch for ${agent.id}?`,
        ordinal,
        agent.id,
      ],
    );
  }
  return db;
};

type Snapshot = {
  readonly agents: ReadonlyArray<unknown>;
  readonly messages: ReadonlyArray<unknown>;
  readonly turnEvents: ReadonlyArray<unknown>;
  readonly openQuestions: ReadonlyArray<unknown>;
};

const snapshot = async ({ db }: { readonly db: Database }): Promise<Snapshot> => {
  const agents = await db.select<{
    readonly id: string;
    readonly deleted_at: number | null;
    readonly output_summary: string | null;
  }>('SELECT id, deleted_at, output_summary FROM agents ORDER BY id');
  return {
    agents: agents.map((row) => ({
      id: row.id,
      deleted:
        row.deleted_at === null ? 'live' : row.deleted_at === EARLIER_DELETE ? 'earlier' : 'now',
      summary: row.output_summary,
    })),
    messages: await db.select('SELECT id, agent_id FROM messages ORDER BY id'),
    turnEvents: await db.select('SELECT id, agent_id FROM turn_events ORDER BY id'),
    openQuestions: await db.select('SELECT id, status FROM open_questions ORDER BY id'),
  };
};

const deleteEachByHand = async ({
  db,
  owned,
}: {
  readonly db: Database;
  readonly owned: ReadonlyArray<string>;
}): Promise<ReadonlyArray<string>> => {
  const removed: Array<string> = [];
  for (const id of owned) {
    removed.push(...(await purgeAgentForDelete({ db, id: id as AgentId })));
  }
  return removed;
};

describe('a run delete is a bulk single-agent delete', () => {
  for (const [kind, fixture] of Object.entries(FIXTURES)) {
    it(`leaves ${kind} exactly as deleting each agent by hand`, async () => {
      const byRun = await seed({ fixture });
      const byHand = await seed({ fixture });

      const runRemoved = await detachWorkflowFromSession(byRun, sessionId, RUN, NOW);
      const handRemoved = await deleteEachByHand({ db: byHand, owned: fixture.owned });

      expect([...runRemoved].sort()).toEqual([...handRemoved].sort());
      expect(await snapshot({ db: byRun })).toEqual(await snapshot({ db: byHand }));
      const after = await snapshot({ db: byRun });
      expect(after.messages).toEqual([
        { id: 'msg-notify-step', agent_id: 'notify-step' },
        { id: 'msg-standalone', agent_id: 'standalone' },
      ]);
      expect(after.turnEvents).toEqual([
        { id: 'event-notify-step', agent_id: 'notify-step' },
        { id: 'event-standalone', agent_id: 'standalone' },
      ]);
    });

    it(`prunes ${kind} on reorder exactly as deleting each agent by hand`, async () => {
      const byReorder = await seed({ fixture });
      const byHand = await seed({ fixture });

      const reorderRemoved = await updateWorkflowOrder(byReorder, sessionId, [OTHER_RUN], NOW);
      const handRemoved = await deleteEachByHand({ db: byHand, owned: fixture.owned });

      expect([...reorderRemoved].sort()).toEqual([...handRemoved].sort());
      expect(await snapshot({ db: byReorder })).toEqual(await snapshot({ db: byHand }));
    });
  }

  it('cleans the leftovers of a run removed without its agents exactly as a by-hand delete', async () => {
    const fixture = FIXTURES['a preset or custom run'];
    if (fixture === undefined) {
      throw new Error('missing fixture');
    }
    const withCleanup = await seed({ fixture });
    const byHand = await seed({ fixture });
    for (const db of [withCleanup, byHand]) {
      await db.execute('DELETE FROM session_workflows WHERE workflow_run_id = ?', [RUN]);
    }

    const cleaned = await deleteOrphanedWorkflowAgents({ db: withCleanup, now: Date.parse(NOW) });
    const handRemoved = await deleteEachByHand({
      db: byHand,
      owned: ['scout', 'builder'],
    });

    expect(cleaned.agentsDeleted).toBe(2);
    expect(cleaned.removedQuestions.map((question) => question.text).sort()).toEqual(
      [...handRemoved].sort(),
    );
    expect(await snapshot({ db: withCleanup })).toEqual(await snapshot({ db: byHand }));
  });
});
