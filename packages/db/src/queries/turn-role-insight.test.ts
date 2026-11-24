import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoTreeId,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import {
  AUTO_SEED_DAY_MS,
  AUTO_SEED_NOW,
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '../test-helpers/auto-seeds';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  insertAutoDelegationStatement,
  settleAutoDelegationStatement,
  type NewAutoDelegation,
} from './auto-delegations';
import { getTurnRoleInsight } from './turn-role-insight';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NOW = AUTO_SEED_NOW;
const DAY = AUTO_SEED_DAY_MS;

type SpanSeed = {
  readonly id: string;
  readonly agentId?: string | null;
  readonly role: string;
  readonly provider?: string;
  readonly model: string;
  readonly effort?: string | null;
  readonly endedAt?: number;
  readonly endReason?: 'succeeded' | 'failed' | 'cancelled' | 'awaiting_user';
  readonly costUsd?: number | null;
};

type SpanParams = {
  readonly db: Database;
  readonly span: SpanSeed;
};

const addSpan = async ({ db, span }: SpanParams): Promise<void> => {
  const endedAt = span.endedAt ?? NOW;
  await db.execute(
    `INSERT INTO agent_turn_spans
       (run_id, agent_id, session_id, workspace_id, workflow_run_id, step_role, provider, model,
        effort, started_at, ended_at, end_reason, cost_usd)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      span.id,
      span.agentId ?? null,
      AUTO_SEED_SESSION,
      WORKSPACE,
      span.role,
      span.provider ?? 'anthropic',
      span.model,
      span.effort === undefined ? 'medium' : span.effort,
      endedAt - 60_000,
      endedAt,
      span.endReason ?? 'succeeded',
      span.costUsd === undefined ? 0.5 : span.costUsd,
    ],
  );
};

const world = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({
    db,
    agentIds: ['agent-step-pinned', 'agent-step-picked', 'agent-helper', 'agent-helper-plain'],
  });
  await db.execute('UPDATE agents SET routing_lock = ? WHERE id = ?', [
    JSON.stringify({
      version: 1,
      pick: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
      origin: 'user',
    }),
    'agent-step-pinned',
  ]);
  await db.execute('UPDATE agents SET routing_decision = ? WHERE id = ?', [
    JSON.stringify({
      version: 1,
      proposal: null,
      selected: { provider: 'codex', model: 'sol', effort: 'medium' },
      source: 'heuristic',
      reason: 'Fits the step',
      adjustment: 'none',
      executed: null,
    }),
    'agent-step-picked',
  ]);
  await seedAutoTree({ db });
  return db;
};

type DelegationParams = {
  readonly id: string;
  readonly childAgentId: string;
  readonly routing: Readonly<Record<string, unknown>>;
  readonly nowMs?: number;
};

const delegation = ({
  id,
  childAgentId,
  routing,
  nowMs = NOW,
}: DelegationParams): NewAutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: id }),
  treeId: brandId<AutoTreeId>({ value: 'tree-1' }),
  generation: 1,
  requestId: brandId<AutoRequestId>({ value: `request-${id}` }),
  requestHash: `hash-${id}`,
  batchId: brandId<AutoBatchId>({ value: `batch-${id}` }),
  slot: 0,
  childAgentId: brandId<AgentId>({ value: childAgentId }),
  firstAttemptId: brandId<AutoAttemptId>({ value: `attempt-${id}` }),
  role: 'implementer',
  request: { task: 'split payments-api refunds' },
  target: { mountId: 'mount-ledger-core' },
  routing,
  state: 'accepted',
  retryOf: null,
  reviseOf: null,
  baseRevision: null,
  isAdopted: false,
  deadlineAt: nowMs + 1_800_000,
  nowMs,
});

const HELPER_ENDED_AT = NOW + 120_000;

const U5_ROUTING = {
  provider: 'codex',
  model: 'sol',
  effort: 'medium',
  pick: { provider: 'codex', model: 'sol', effort: 'medium' },
  reason: 'Codex has the most room for a writer',
  candidates: [
    { provider: 'codex', model: 'sol', room: 0.8 },
    { provider: 'anthropic', model: 'claude-sonnet-5-5', room: 0.4 },
  ],
};

type DelegateParams = {
  readonly db: Database;
};

const delegateTwice = async ({ db }: DelegateParams): Promise<void> => {
  await db.transaction({
    statements: [
      insertAutoDelegationStatement({
        delegation: delegation({ id: 'first', childAgentId: 'agent-helper', routing: U5_ROUTING }),
      }),
      settleAutoDelegationStatement({
        delegationId: brandId<AutoDelegationId>({ value: 'first' }),
        generation: 1,
        outcome: 'failed',
        reason: 'retry',
        result: null,
        nowMs: NOW,
        abortCode: 'settle',
      }),
      insertAutoDelegationStatement({
        delegation: delegation({ id: 'retry', childAgentId: 'agent-helper', routing: U5_ROUTING }),
      }),
      insertAutoDelegationStatement({
        delegation: delegation({
          id: 'plain',
          childAgentId: 'agent-helper-plain',
          routing: {
            provider: 'anthropic',
            model: 'claude-sonnet-5-5',
            effort: null,
            reason: 'The session default',
            proposal: 'none',
            requested: { provider: null, model: null, effort: null },
          },
        }),
      }),
    ],
  });
};

describe('getTurnRoleInsight', () => {
  it('groups turns by role, then by model, with effort, cost and failures', async () => {
    const db = await world();
    await addSpan({ db, span: { id: 'r1', role: 'implementer', model: 'claude-sonnet-5-5' } });
    await addSpan({
      db,
      span: { id: 'r2', role: 'implementer', model: 'claude-sonnet-5-5', effort: 'high' },
    });
    await addSpan({
      db,
      span: {
        id: 'r3',
        role: 'implementer',
        provider: 'codex',
        model: 'sol',
        endReason: 'failed',
        costUsd: 1.25,
      },
    });
    await addSpan({
      db,
      span: { id: 'r4', role: 'scout', model: 'claude-haiku-5-5', effort: null, costUsd: null },
    });

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    expect(insight.turns).toBe(4);
    expect(insight.costUsd).toBeCloseTo(2.25);
    expect(insight.roles.map((role) => [role.role, role.turns])).toEqual([
      ['implementer', 3],
      ['scout', 1],
    ]);
    const implementer = insight.roles[0];
    expect(implementer?.costPerTurnUsd).toBeCloseTo(0.75);
    expect(implementer?.failedTurns).toBe(1);
    expect(implementer?.models.map((model) => [model.provider, model.model, model.turns])).toEqual([
      ['anthropic', 'claude-sonnet-5-5', 2],
      ['codex', 'sol', 1],
    ]);
    expect(implementer?.models[0]?.efforts).toEqual(
      expect.arrayContaining([
        { effort: 'medium', turns: 1 },
        { effort: 'high', turns: 1 },
      ]),
    );
    expect(insight.roles[1]?.efforts).toEqual([{ effort: null, turns: 1 }]);
    expect(insight.efforts[0]).toEqual({ effort: 'medium', turns: 2 });
    expect(insight.roles[1]).toMatchObject({ pricedTurns: 0, costUsd: null, costPerTurnUsd: null });
    expect(insight.pricedTurns).toBe(3);
    expect(insight.costPerTurnUsd).toBeCloseTo(0.75);
  });

  it('counts only turns that ended inside the window and only in this workspace', async () => {
    const db = await world();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace-northwind', 'Northwind', 'northwind', 0, 0)",
    );
    await addSpan({ db, span: { id: 'fresh', role: 'tester', model: 'claude-haiku-5-5' } });
    await addSpan({
      db,
      span: { id: 'old', role: 'tester', model: 'claude-haiku-5-5', endedAt: NOW - 40 * DAY },
    });
    await db.execute(
      `INSERT INTO agent_turn_spans
         (run_id, workspace_id, step_role, provider, model, started_at, ended_at, end_reason)
       VALUES ('elsewhere', 'workspace-northwind', 'tester', 'anthropic', 'claude-haiku-5-5', ?, ?, 'succeeded')`,
      [NOW - 1000, NOW],
    );

    const month = await getTurnRoleInsight({
      db,
      workspaceId: WORKSPACE,
      sinceMs: NOW - 30 * DAY,
    });
    const always = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    expect(month.turns).toBe(1);
    expect(always.turns).toBe(2);
  });

  it('says pinned for a locked step, picked for a routed step, and not known without a record', async () => {
    const db = await world();
    await addSpan({
      db,
      span: {
        id: 'pinned',
        agentId: 'agent-step-pinned',
        role: 'planner',
        model: 'claude-opus-5-5',
      },
    });
    await addSpan({
      db,
      span: {
        id: 'override',
        agentId: 'agent-step-pinned',
        role: 'planner',
        model: 'claude-sonnet-5-5',
      },
    });
    await addSpan({
      db,
      span: { id: 'picked', agentId: 'agent-step-picked', role: 'planner', model: 'sol' },
    });
    await addSpan({
      db,
      span: { id: 'lead', agentId: 'agent-auto-root', role: 'auto', model: 'x' },
    });
    await addSpan({ db, span: { id: 'gone', agentId: null, role: 'planner', model: 'opus' } });

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });
    const planner = insight.roles.find((role) => role.role === 'planner');

    expect(planner).toMatchObject({ turns: 4, knownTurns: 3, pinnedTurns: 1, leadPickTurns: 0 });
    expect(insight.roles.find((role) => role.role === 'auto')?.knownTurns).toBe(0);
    expect(insight).toMatchObject({ turns: 5, knownTurns: 3, pinnedTurns: 1 });
  });

  it("counts a helper with the Lead's routing once and as the Lead's pick", async () => {
    const db = await world();
    await delegateTwice({ db });
    await addSpan({
      db,
      span: {
        id: 'helper-1',
        agentId: 'agent-helper',
        role: 'implementer',
        model: 'sol',
        endedAt: HELPER_ENDED_AT,
      },
    });
    await addSpan({
      db,
      span: {
        id: 'helper-2',
        agentId: 'agent-helper-plain',
        role: 'implementer',
        model: 'claude-sonnet-5-5',
        endedAt: HELPER_ENDED_AT,
      },
    });

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    expect(insight.roles[0]).toMatchObject({
      role: 'implementer',
      turns: 2,
      knownTurns: 2,
      leadPickTurns: 1,
      pinnedTurns: 0,
    });
  });

  it('keeps an earlier turn on the routing it ran with when a later retry asks for a model', async () => {
    const db = await world();
    await delegateTwice({ db });
    await addSpan({
      db,
      span: {
        id: 'plain-1',
        agentId: 'agent-helper-plain',
        role: 'implementer',
        model: 'claude-sonnet-5-5',
        endedAt: HELPER_ENDED_AT,
      },
    });
    await db.transaction({
      statements: [
        settleAutoDelegationStatement({
          delegationId: brandId<AutoDelegationId>({ value: 'plain' }),
          generation: 1,
          outcome: 'failed',
          reason: 'retry',
          result: null,
          nowMs: HELPER_ENDED_AT,
          abortCode: 'settle',
        }),
        insertAutoDelegationStatement({
          delegation: delegation({
            id: 'plain-retry',
            childAgentId: 'agent-helper-plain',
            routing: U5_ROUTING,
            nowMs: HELPER_ENDED_AT + 60_000,
          }),
        }),
      ],
    });
    await addSpan({
      db,
      span: {
        id: 'plain-2',
        agentId: 'agent-helper-plain',
        role: 'implementer',
        provider: 'codex',
        model: 'sol',
        endedAt: HELPER_ENDED_AT + 180_000,
      },
    });

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    expect(insight.roles[0]).toMatchObject({ turns: 2, knownTurns: 2, leadPickTurns: 1 });
  });
});
