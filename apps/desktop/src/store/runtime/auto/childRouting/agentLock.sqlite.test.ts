import { describe, expect, it } from 'vitest';
import { listAutoDelegations } from '@goodboy/db';
import type { RoutingOutcome, RoutingRequest } from '../ports';
import { runAutoCommand } from '../runAutoCommand';
import { continueChild } from '../talk/continueChild';
import { READY_ROUTING, WORLD_GRANT } from '../testing/fakePorts';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SCOUT = {
  role: 'scout',
  task: 'Find the callers of the ledger export.',
  reason: 'Reading code is the work of a scout.',
};

const SCOUT_AGENT = 'id-2';

const WAIT =
  'Codex is cooling down until 16:10. This agent keeps its model, so send it again then.';

const settledScout = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10, agentIds: [SCOUT_AGENT] });
  await userSays({ world, id: 'outbox-user-1', text: 'find the ledger export callers' });
  await autoDelegates({ world, spec: { children: [SCOUT] } });
  await autoTurnEnds({ world });
  await childTurnEnds({
    world,
    index: 0,
    text: `Found three callers.\n<<step-done id="${SCOUT_AGENT}">>`,
  });
  await autoTurnEnds({ world, text: 'The scout found three callers.' });
  return world;
};

type CapturedParams = {
  readonly world: RuntimeWorld;
  readonly outcome: RoutingOutcome;
};

const capturing = ({ world, outcome }: CapturedParams) => {
  const requests: RoutingRequest[] = [];
  const ctx = {
    ...world.state.ctx,
    ports: {
      ...world.state.ctx.ports,
      resolveRouting: async (request: RoutingRequest) => {
        requests.push(request);
        return outcome;
      },
    },
  };
  return { ctx, requests };
};

describe('an agent that goes on keeps its provider and model', () => {
  it('hands its stored pick as a lock when a person writes to it, and passes on the wait', async () => {
    const world = await settledScout();
    const [original] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    if (original === undefined) {
      throw new Error('a delegation was expected');
    }
    const { ctx, requests } = capturing({
      world,
      outcome: { kind: 'blocked', code: 'no_provider', message: WAIT },
    });

    const outcome = await continueChild({
      ctx,
      childAgentId: original.childAgentId,
      text: 'Why did you skip the tests folder?',
      from: 'user',
      sleep: async () => undefined,
    });

    expect(requests[0]?.agentLock).toEqual({
      provider: original.routing['provider'],
      model: original.routing['model'],
      effort: original.routing['effort'],
    });
    expect(outcome).toEqual({ kind: 'refused', code: 'no_provider', message: WAIT });
  });

  it('lets a retry with no new task pick again', async () => {
    const world = await settledScout();
    const [original] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    const { ctx, requests } = capturing({ world, outcome: READY_ROUTING });
    await userSays({ world, id: 'outbox-user-2', text: 'try that again' });

    await runAutoCommand({
      ctx,
      command: {
        verb: 'delegate',
        grant: { ...WORLD_GRANT, runId: world.state.ports.autoTurns.at(-1)?.runId ?? '' },
        args: {
          'request-id': 'request-retry',
          spec: JSON.stringify({ children: [{ retryOf: original?.id, reason: 'Once more.' }] }),
        },
      },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.fields).toMatchObject({ provider: original?.routing['provider'] });
    expect(requests[0]?.agentLock ?? null).toBeNull();
  });
});
