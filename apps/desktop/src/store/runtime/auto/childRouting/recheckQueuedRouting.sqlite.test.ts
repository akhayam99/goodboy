import { describe, expect, it } from 'vitest';
import { listAutoDelegations } from '@goodboy/db';
import type { RoutingOutcome } from '../ports';
import {
  autoTurnEndsWithBlock,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SIX_SCOUTS = {
  action: 'delegate',
  requestId: 'request-six',
  children: ['a', 'b', 'c', 'd', 'e', 'f'].map((area) => ({
    role: 'scout',
    task: `map area ${area} of ledger-core`,
    reason: 'reading code',
    taskType: 'research',
    difficulty: 'hard',
  })),
};

const STORED = { provider: 'anthropic', model: 'sonnet' } as const;

const CODEX_ROUTING: Extract<RoutingOutcome, { kind: 'ready' }> = {
  kind: 'ready',
  provider: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  reason: 'Codex: first in your order that fits',
  proposal: 'replaced',
};

const MOVED_REASON =
  'The Lead asked for Claude Sonnet: cooling down after a limit. Codex: first in your order that fits.';

type WorldParams = {
  readonly world: RuntimeWorld;
};

const started = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 20 });
  await userSays({ world, id: 'outbox-user-1', text: 'map every area of ledger-core' });
  await autoTurnEndsWithBlock({ world, block: SIX_SCOUTS });
  return world;
};

const endFirstChild = async ({ world }: WorldParams): Promise<void> => {
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('a running child was expected');
  }
  await childTurnEnds({
    world,
    index: 0,
    text: `Mapped it.\n<<artifact v=1 kind=report>>\n{"title":"Area map","format":"markdown","content":"mapped"}\n<</artifact>>\n<<step-done id="${String(turn.childAgentId)}">>`,
  });
};

describe('a queued helper when its turn comes', () => {
  it('starts on the next provider when the stored one cooled down meanwhile, and says why', async () => {
    const world = await started();
    world.state.ports.setRouting({
      kind: 'ready',
      provider: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'medium',
      reason: MOVED_REASON,
      proposal: 'replaced',
      source: 'fallback',
      cause: 'cooldown',
      candidates: [],
    });

    await endFirstChild({ world });

    const fifth = world.state.ports.childTurns[4];
    expect(fifth?.routedModel).toEqual({ provider: 'codex', model: 'gpt-6.1-sol' });
    const stored = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.id === fifth?.delegationId);
    expect(stored?.routing).toMatchObject({
      provider: 'codex',
      model: 'gpt-6.1-sol',
      reason: MOVED_REASON,
      proposal: 'replaced',
      source: 'fallback',
      cause: 'cooldown',
    });
    expect(world.errors).toEqual([]);
  });

  it('keeps the stored model when it can still run', async () => {
    const world = await started();
    world.state.ports.setRouting({ ...CODEX_ROUTING, source: 'lead', cause: null });

    await endFirstChild({ world });

    expect(world.state.ports.childTurns[4]?.routedModel).toEqual(STORED);
  });

  it('rechecks with the step size the Lead routed for', async () => {
    const world = await started();

    await endFirstChild({ world });

    expect(world.state.ports.routingRequests.at(-1)?.fields).toMatchObject({
      taskType: 'research',
      difficulty: 'hard',
    });
  });

  it('keeps the stored model when the pick moved for a reason that is not the provider', async () => {
    const world = await started();
    world.state.ports.setRouting({ ...CODEX_ROUTING, source: 'fallback', cause: 'not-listed' });

    await endFirstChild({ world });

    expect(world.state.ports.childTurns[4]?.routedModel).toEqual(STORED);
  });
});
