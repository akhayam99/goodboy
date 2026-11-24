import { describe, expect, it } from 'vitest';
import { bestCandidate, buildCandidates } from '@goodboy/core/providers';
import { listAutoDelegations } from '@goodboy/db';
import type { RoutingOutcome, RoutingRequest } from '../ports';
import { runAutoCommand } from '../runAutoCommand';
import { WORLD_GRANT } from '../testing/fakePorts';
import {
  autoDelegates,
  autoTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const PLANNER = {
  role: 'planner',
  task: 'Plan the ledger export in ledger-core.',
  reason: 'A plan comes before the change.',
};

const SECOND_PLANNER = { ...PLANNER, task: 'Plan the notify-relay side of the export.' };

const CURSOR_PICK: RoutingOutcome = {
  kind: 'ready',
  provider: 'cursor',
  model: 'sonnet-5.5',
  effort: 'xhigh',
  reason: 'Cursor: first in your order',
  proposal: 'none',
};

const REFUSAL = 'This agent runs only on the model Auto chose for it.';

const candidatePick = (request: RoutingRequest): RoutingOutcome => {
  const best = bestCandidate({
    list: buildCandidates({
      inputs: {
        defaultProvider: 'cursor',
        rule: 'order',
        policy: [
          { id: 'cursor', state: 'on' },
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
        ],
      },
      need: {
        role: request.role,
        size: 'medium',
        scope: 'helper',
        failedStarts: request.failedStarts ?? null,
      },
    }),
  });
  if (best === null) {
    return { kind: 'blocked', code: 'no_provider', message: 'No provider fits this step.' };
  }
  return {
    kind: 'ready',
    provider: best.provider,
    model: best.model,
    effort: best.effort,
    reason: 'first in your order that fits',
    proposal: 'none',
  };
};

const twoRefusedStarts = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'plan the ledger export' });
  world.state.ports.setRouting(CURSOR_PICK);
  world.state.ports.setChildOutcome({
    kind: 'refused',
    reason: 'kickoff_failed',
    message: REFUSAL,
  });
  await autoDelegates({ world, spec: { children: [PLANNER, SECOND_PLANNER] } });
  await autoTurnEnds({ world });
  return world;
};

type RetryParams = {
  readonly world: RuntimeWorld;
  readonly extra?: Readonly<Record<string, string>>;
};

const retryFirst = async ({ world, extra = {} }: RetryParams) => {
  const [original] = await listAutoDelegations({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  const requests: RoutingRequest[] = [];
  const ctx = {
    ...world.state.ctx,
    ports: {
      ...world.state.ctx.ports,
      resolveRouting: async (request: RoutingRequest) => {
        requests.push(request);
        return candidatePick(request);
      },
    },
  };
  await userSays({ world, id: 'outbox-user-2', text: 'try the plan again' });
  await runAutoCommand({
    ctx,
    command: {
      verb: 'delegate',
      grant: { ...WORLD_GRANT, runId: world.state.ports.autoTurns.at(-1)?.runId ?? '' },
      args: {
        'request-id': 'request-retry',
        spec: JSON.stringify({
          children: [{ retryOf: original?.id, reason: 'Once more.', ...extra }],
        }),
      },
    },
  });
  const delegations = await listAutoDelegations({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  return { requests, retried: delegations.find((row) => row.retryOf === original?.id) };
};

describe('a helper that did not start', () => {
  it('moves the next pick for its role to another provider after two refused starts', async () => {
    const world = await twoRefusedStarts();
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((row) => row.reason)).toEqual([
      `kickoff_failed: ${REFUSAL}`,
      `kickoff_failed: ${REFUSAL}`,
    ]);

    const { requests, retried } = await retryFirst({ world });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.failedStarts).toEqual(['cursor']);
    expect(requests[0]?.agentLock ?? null).toBeNull();
    expect(retried?.routing['provider']).not.toBe('cursor');
    expect(retried?.routing['provider']).toBe('anthropic');
  });

  it('does not carry the route that failed into what the retry asked for', async () => {
    const world = await twoRefusedStarts();

    const { requests, retried } = await retryFirst({ world });

    expect(requests[0]?.fields).toMatchObject({ provider: undefined, model: undefined });
    expect(retried?.routing['requested']).toEqual({ provider: null, model: null, effort: null });
  });

  it('drops the failed route even when the Lead names it again on the retry', async () => {
    const world = await twoRefusedStarts();

    const { requests, retried } = await retryFirst({
      world,
      extra: { provider: 'cursor', model: 'sonnet-5.5' },
    });

    expect(requests[0]?.fields).toMatchObject({ provider: undefined, model: undefined });
    expect(retried?.routing['provider']).toBe('anthropic');
  });
});
