import { describe, expect, it } from 'vitest';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../auto/testing/runtimeWorld';
import { readAutoTreeViews } from './readAutoTreeViews';
import { sameAutoTreeViews } from './sameAutoTreeViews';

const REVIEW_BATCH = {
  children: [
    {
      role: 'implementer',
      task: 'Fix the retry in ledger-core.',
      reason: 'a change',
      mount: 'mount-ledger-core',
    },
    {
      role: 'implementer',
      task: 'Fix the webhook in notify-relay.',
      reason: 'a second change',
      mount: 'mount-notify-relay',
    },
    { role: 'scout', task: 'Find why the webhook fires twice.', reason: 'a search' },
  ],
};

const done = (childAgentId: string, text: string) => `${text}\n<<step-done id="${childAgentId}">>`;

const read = async (world: RuntimeWorld) =>
  readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });

const reviewed = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 20 });
  await userSays({ world, id: 'outbox-user-1', text: 'review the retry fix' });
  await autoDelegates({ world, spec: REVIEW_BATCH });
  await autoTurnEnds({ world });
  const [first, second, third] = world.state.ports.childTurns;
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('three children were expected');
  }
  await childTurnEnds({
    world,
    index: 0,
    text: done(first.childAgentId, 'Built the key once per credit.'),
  });
  await childTurnEnds({
    world,
    index: 1,
    text: done(second.childAgentId, 'The webhook now dedupes by event id.'),
  });
  await childTurnEnds({ world, index: 2, text: 'crashed', overrides: { exit: 'error' } });
  return world;
};

describe('the results each Auto turn read, as the chat draws them', () => {
  it('names nothing while the batch is still open', async () => {
    const world = await makeRuntimeWorld({ capUsd: 20 });
    await userSays({ world, id: 'outbox-user-1', text: 'review the retry fix' });
    await autoDelegates({ world, spec: REVIEW_BATCH });
    await autoTurnEnds({ world });
    const first = world.state.ports.childTurns[0];
    if (first === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({
      world,
      index: 0,
      text: done(first.childAgentId, 'Built the key once per credit.'),
    });

    const views = await read(world);
    expect(views[0]?.deliveredResults).toEqual([]);
  });

  it('ties every child result to the Auto run that read it, failed ones included', async () => {
    const world = await reviewed();
    const runId = world.state.ports.autoTurns[1]?.runId;

    const views = await read(world);

    expect(views[0]?.deliveredResults.map((result) => [result.role, result.outcome])).toEqual([
      ['implementer', 'completed'],
      ['implementer', 'completed'],
      ['scout', 'failed'],
    ]);
    expect(views[0]?.deliveredResults.every((result) => result.runId === runId)).toBe(true);
    expect(views[0]?.deliveredResults.map((result) => result.summary)).toEqual([
      'Built the key once per credit.',
      'The webhook now dedupes by event id.',
      'crashed',
    ]);
    expect(views[0]?.deliveredResults.map((result) => result.childAgentId)).toEqual(
      world.state.ports.childTurns.map((turn) => turn.childAgentId),
    );
  });

  it('gives Auto the same names the cards show', async () => {
    const world = await reviewed();

    const text = world.state.ports.autoTurns[1]?.text ?? '';

    expect(text).toContain('- Implementer 1 (implementer ');
    expect(text).toContain('- Implementer 2 (implementer ');
    expect(text).toContain('- Scout (scout ');
  });

  it('reads the same cards again from the database, as a reload or a second window does', async () => {
    const world = await reviewed();

    const first = await read(world);
    const second = await read(world);

    expect(second[0]?.deliveredResults).toEqual(first[0]?.deliveredResults);
    expect(sameAutoTreeViews({ first, second })).toBe(true);
  });

  it('keeps a result with the turn that read it when a later turn reads another', async () => {
    const world = await reviewed();
    const firstRun = world.state.ports.autoTurns[1]?.runId;
    await autoDelegates({
      world,
      spec: {
        children: [{ role: 'scout', task: 'Find the webhook handler.', reason: 'a search' }],
      },
      requestId: 'request-2',
    });
    await autoTurnEnds({ world });
    const scout = world.state.ports.childTurns[3];
    if (scout === undefined) {
      throw new Error('a scout was expected');
    }
    await childTurnEnds({ world, index: 3, text: done(scout.childAgentId, 'In webhooks.ts.') });
    const laterRun = world.state.ports.autoTurns[2]?.runId;

    const views = await read(world);
    const byRole = views[0]?.deliveredResults.map((result) => [result.role, result.runId]);

    expect(laterRun).not.toBe(firstRun);
    expect(byRole).toEqual([
      ['implementer', firstRun],
      ['implementer', firstRun],
      ['scout', firstRun],
      ['scout', laterRun],
    ]);
  });
});
