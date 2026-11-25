// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../storyHarness';
import { recordTurnSpan } from '../recordTurnSpan';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const HELPERS = ['helper-lead', 'helper-fallback', 'helper-pin', 'helper-rule'];
const STEPS = ['step-locked', 'step-heuristic'];

type PickRow = {
  readonly run_id: string;
  readonly source: string;
  readonly adjustment: string | null;
  readonly requested_model: string | null;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type DelegationParams = {
  readonly agentId: string;
  readonly routing: Readonly<Record<string, unknown>>;
};

const delegate = async ({ agentId, routing }: DelegationParams): Promise<void> => {
  await storySqlite().execute(
    `INSERT INTO auto_delegations
      (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
       first_attempt_id, role, request_json, target_json, routing_json, deadline_at, created_at)
     VALUES (?, 'tree-1', 1, ?, 'hash', 'batch-1', 0, ?, ?, 'implementer', '{}', '{}', ?, ?, ?)`,
    [
      `d-${agentId}`,
      `r-${agentId}`,
      agentId,
      `a-${agentId}`,
      JSON.stringify(routing),
      AUTO_SEED_NOW,
      AUTO_SEED_NOW,
    ],
  );
};

type RoutingParams = {
  readonly source: string;
  readonly extra?: Readonly<Record<string, unknown>>;
};

const routingOf = ({ source, extra = {} }: RoutingParams) => ({
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  reason: 'Picked for the export',
  proposal: 'kept',
  source,
  requested: { provider: 'anthropic', model: 'claude-opus-5-5', effort: null },
  ...extra,
});

type DecisionParams = {
  readonly agentId: string;
  readonly source: string;
};

const decide = async ({ agentId, source }: DecisionParams): Promise<void> => {
  const pick = { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: null };
  await storySqlite().execute('UPDATE agents SET routing_decision = ? WHERE id = ?', [
    JSON.stringify({
      version: 1,
      proposal: null,
      selected: pick,
      source,
      reason: 'Step default',
      adjustment: 'none',
      executed: pick,
    }),
    agentId,
  ]);
};

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite(), agentIds: [...HELPERS, ...STEPS] });
  await seedAutoTree({ db: storySqlite() });
  await delegate({ agentId: 'helper-lead', routing: routingOf({ source: 'lead' }) });
  await delegate({
    agentId: 'helper-fallback',
    routing: routingOf({
      source: 'fallback',
      extra: { proposal: 'replaced', cause: 'not-listed' },
    }),
  });
  await delegate({ agentId: 'helper-pin', routing: routingOf({ source: 'pin' }) });
  await delegate({
    agentId: 'helper-rule',
    routing: routingOf({ source: 'rule', extra: { proposal: 'none' } }),
  });
  await decide({ agentId: 'step-locked', source: 'run_role_lock' });
  await decide({ agentId: 'step-heuristic', source: 'heuristic' });
});

type TurnParams = {
  readonly agentId: string;
  readonly model?: string;
};

const turnEnds = async ({ agentId, model = 'claude-sonnet-5-5' }: TurnParams): Promise<void> => {
  await recordTurnSpan({
    get: useAppStore.getState,
    span: {
      runId: brandId<ProviderRunId>({ value: `run-${agentId}` }),
      agentId: brandId<AgentId>({ value: agentId }),
      sessionId: AUTO_SEED_SESSION,
      workspaceId: WORKSPACE,
      workflowRunId: null,
      stepRole: 'implementer',
      provider: 'anthropic',
      model,
      effort: null,
      startedAt: brandId<IsoDateTime>({ value: '2026-11-20T10:00:00.000Z' }),
      endedAt: brandId<IsoDateTime>({ value: '2026-11-20T10:01:00.000Z' }),
      endReason: 'succeeded',
      touchedMountIds: [],
    },
  });
};

const picks = () =>
  storySqlite().select<PickRow>(
    'SELECT run_id, source, adjustment, requested_model FROM agent_turn_picks ORDER BY run_id',
  );

describe('recordTurnPick, written with the span of each turn', () => {
  it('names the cause of a helper turn from the pick the Lead stored', async () => {
    for (const agentId of HELPERS) {
      await turnEnds({ agentId });
    }

    expect(await picks()).toEqual([
      {
        run_id: 'run-helper-fallback',
        source: 'fallback',
        adjustment: 'not-listed',
        requested_model: 'claude-opus-5-5',
      },
      {
        run_id: 'run-helper-lead',
        source: 'lead',
        adjustment: null,
        requested_model: 'claude-opus-5-5',
      },
      {
        run_id: 'run-helper-pin',
        source: 'pinned',
        adjustment: null,
        requested_model: 'claude-opus-5-5',
      },
      {
        run_id: 'run-helper-rule',
        source: 'best',
        adjustment: null,
        requested_model: 'claude-opus-5-5',
      },
    ]);
  });

  it('names a workflow step pinned by a lock, and best candidate otherwise', async () => {
    for (const agentId of STEPS) {
      await turnEnds({ agentId });
    }

    expect((await picks()).map((row) => [row.run_id, row.source])).toEqual([
      ['run-step-heuristic', 'best'],
      ['run-step-locked', 'pinned'],
    ]);
  });

  it('counts a turn that ran off its pin as best candidate, not pinned', async () => {
    await turnEnds({ agentId: 'step-locked', model: 'claude-haiku-5-5' });
    await turnEnds({ agentId: 'helper-pin', model: 'claude-haiku-5-5' });

    expect((await picks()).map((row) => [row.run_id, row.source])).toEqual([
      ['run-helper-pin', 'best'],
      ['run-step-locked', 'best'],
    ]);
  });

  it('keeps one pick per turn, the one known when the turn ended', async () => {
    await turnEnds({ agentId: 'helper-lead' });
    await storySqlite().execute(
      "UPDATE auto_delegations SET routing_json = ? WHERE child_agent_id = 'helper-lead'",
      [JSON.stringify(routingOf({ source: 'fallback' }))],
    );

    await turnEnds({ agentId: 'helper-lead' });

    expect((await picks()).map((row) => [row.run_id, row.source])).toEqual([
      ['run-helper-lead', 'lead'],
    ]);
  });

  it('writes no pick for a turn whose model has no known cause', async () => {
    await turnEnds({ agentId: 'agent-auto-root' });

    expect(await picks()).toEqual([]);
    expect(
      await storySqlite().select(
        "SELECT run_id FROM agent_turn_spans WHERE run_id = 'run-agent-auto-root'",
      ),
    ).toHaveLength(1);
  });
});
