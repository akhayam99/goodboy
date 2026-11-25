import { describe, expect, it } from 'vitest';
import { brandId, type ProviderRunId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import {
  AUTO_SEED_DAY_MS,
  AUTO_SEED_NOW,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '../test-helpers/auto-seeds';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertAgentTurnPick, type AgentTurnPickSource } from './agent-turn-pick';
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
  await seedAutoSession({ db, agentIds: ['agent-step', 'agent-helper'] });
  return db;
};

type PickParams = {
  readonly db: Database;
  readonly runId: string;
  readonly source: AgentTurnPickSource;
};

const addPick = async ({ db, runId, source }: PickParams): Promise<void> => {
  await insertAgentTurnPick({
    db,
    nowMs: NOW,
    pick: {
      runId: brandId<ProviderRunId>({ value: runId }),
      source,
      adjustment: null,
      requestedModel: null,
    },
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

  it('counts each recorded source once and leaves a turn with no record not known', async () => {
    const db = await world();
    const turns: ReadonlyArray<readonly [string, AgentTurnPickSource | null]> = [
      ['t-pinned', 'pinned'],
      ['t-lead', 'lead'],
      ['t-lead-2', 'lead'],
      ['t-fallback', 'fallback'],
      ['t-best', 'best'],
      ['t-none', null],
    ];
    for (const [id, source] of turns) {
      await addSpan({ db, span: { id, role: 'implementer', model: 'claude-sonnet-5-5' } });
      if (source !== null) {
        await addPick({ db, runId: id, source });
      }
    }

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    const counts = {
      turns: 6,
      knownTurns: 5,
      pinnedTurns: 1,
      leadPickTurns: 2,
      fallbackTurns: 1,
      bestTurns: 1,
    };
    expect(insight).toMatchObject(counts);
    expect(insight.roles[0]).toMatchObject(counts);
  });

  it('keeps a pinned turn pinned after the pin is removed from the step', async () => {
    const db = await world();
    await db.execute('UPDATE agents SET routing_lock = ? WHERE id = ?', [
      JSON.stringify({
        version: 1,
        pick: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
        origin: 'user',
      }),
      'agent-step',
    ]);
    await addSpan({
      db,
      span: { id: 'pinned-run', agentId: 'agent-step', role: 'planner', model: 'claude-opus-5-5' },
    });
    await addPick({ db, runId: 'pinned-run', source: 'pinned' });

    await db.execute('UPDATE agents SET routing_lock = NULL WHERE id = ?', ['agent-step']);
    await addSpan({
      db,
      span: {
        id: 'later-run',
        agentId: 'agent-step',
        role: 'planner',
        model: 'claude-sonnet-5-5',
      },
    });
    await addPick({ db, runId: 'later-run', source: 'best' });

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    expect(insight.roles[0]).toMatchObject({
      turns: 2,
      knownTurns: 2,
      pinnedTurns: 1,
      bestTurns: 1,
    });
  });

  it('leaves a turn without a pick row not known even when its agent holds routing', async () => {
    const db = await world();
    await db.execute('UPDATE agents SET routing_lock = ?, routing_decision = ? WHERE id = ?', [
      JSON.stringify({
        version: 1,
        pick: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
        origin: 'user',
      }),
      JSON.stringify({ version: 1, source: 'step_lock' }),
      'agent-step',
    ]);
    await addSpan({
      db,
      span: { id: 'old-run', agentId: 'agent-step', role: 'planner', model: 'claude-opus-5-5' },
    });

    const insight = await getTurnRoleInsight({ db, workspaceId: WORKSPACE, sinceMs: null });

    expect(insight).toMatchObject({ turns: 1, knownTurns: 0, pinnedTurns: 0, leadPickTurns: 0 });
  });
});
