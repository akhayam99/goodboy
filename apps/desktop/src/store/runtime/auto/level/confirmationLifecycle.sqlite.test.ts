import { describe, expect, it } from 'vitest';
import { listAutoDelegations } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
} from '../testing/runtimeWorld';
import { writeAutoLevel } from './writeAutoLevel';

const target = { sessionId: AUTO_SEED_SESSION };
const scout = { role: 'scout', task: 'read ledger-core', reason: 'find the callers' };

describe('Auto confirmation lifecycle', () => {
  it('keeps confirmation pending after a level change, a drive and recovery', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target, level: 'step' });
    await userSays({ world, id: 'outbox-acme', text: 'read ledger-core' });
    await autoDelegates({ world, spec: [scout] });
    await autoTurnEnds({ world });
    await writeAutoLevel({ db, target, level: 'run' });
    await world.runtime.drive(world.treeId);
    expect(world.state.ports.childTurns).toHaveLength(0);
    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();
    expect(restarted.state.ports.childTurns).toHaveLength(0);
    expect(await listAutoDelegations({ db, treeId: world.treeId })).toMatchObject([
      { state: 'awaiting_confirm' },
    ]);
  });

  it('preserves an explicit confirmation on a retry after the user confirmed the first attempt', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target, level: 'run' });
    await userSays({ world, id: 'outbox-acme', text: 'read ledger-core' });
    await autoDelegates({ world, spec: [{ ...scout, confirm: true }] });
    await autoTurnEnds({ world });
    const original = (await listAutoDelegations({ db, treeId: world.treeId }))[0];
    if (original === undefined) {
      throw new Error('Expected the first delegation');
    }
    await world.runtime.confirm({ delegationId: original.id, decision: 'confirm' });
    await world.runtime.drive(world.treeId);
    await childTurnEnds({ world, index: 0, text: 'Could not finish.' });
    const outcome = await autoDelegates({
      world,
      requestId: 'request-retry',
      spec: [{ retryOf: original.id, reason: 'read ledger-core again' }],
    });
    expect(outcome.isOk).toBe(true);
    await autoTurnEnds({ world });
    const rows = await listAutoDelegations({ db, treeId: world.treeId });
    expect(rows.find((row) => row.retryOf === original.id)).toMatchObject({
      state: 'awaiting_confirm',
      request: { confirm: true },
    });
    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });
});
