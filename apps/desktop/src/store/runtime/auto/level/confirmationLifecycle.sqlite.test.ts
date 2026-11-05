import { describe, expect, it } from 'vitest';
import { storedResultOf } from '@goodboy/core/auto';
import { listAutoDelegations, listAutoOutbox } from '@goodboy/db';
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

type DeclineParams = {
  readonly world: Awaited<ReturnType<typeof makeRuntimeWorld>>;
};

const declineOneStep = async ({ world }: DeclineParams) => {
  const db = world.state.world.db;
  await writeAutoLevel({ db, target, level: 'run' });
  await userSays({ world, id: 'outbox-acme', text: 'read ledger-core' });
  await autoDelegates({ world, spec: [{ ...scout, confirm: true }] });
  await autoTurnEnds({ world });
  const delegation = (await listAutoDelegations({ db, treeId: world.treeId }))[0];
  if (delegation === undefined) {
    throw new Error('Expected the delegation');
  }
  await world.runtime.confirm({ delegationId: delegation.id, decision: 'decline' });
  return delegation;
};

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

  it('tells Auto about a declined step and leaves the chat writable', async () => {
    const world = await makeRuntimeWorld();
    const delegation = await declineOneStep({ world });
    const db = world.state.world.db;
    const settled = (await listAutoDelegations({ db, treeId: world.treeId }))[0];
    expect(storedResultOf({ value: settled?.result })).not.toBeNull();
    await world.runtime.drive(world.treeId);
    const told = world.state.ports.autoTurns.at(-1)?.text ?? '';
    expect(told).toContain(`${delegation.id}): stopped, declined`);
    expect(told).toContain('the user declined this step, so it never ran');
    expect(told).not.toContain('it did not close its work');
    await autoTurnEnds({ world });
    await userSays({ world, id: 'outbox-next', text: 'plan it again' });
    expect(world.errors).toEqual([]);
  });

  it('delivers a result stored without its fields instead of failing every turn', async () => {
    const world = await makeRuntimeWorld();
    const delegation = await declineOneStep({ world });
    const db = world.state.world.db;
    await db.execute(`UPDATE auto_delegations SET result_json = ? WHERE id = ?`, [
      JSON.stringify({ outcome: 'stopped', reason: 'declined', delegationId: delegation.id }),
      delegation.id,
    ]);
    expect(await world.runtime.say({ treeId: world.treeId, text: 'plan it again' })).toMatchObject({
      kind: 'queued',
    });
    await world.runtime.drive(world.treeId);
    const told = world.state.ports.autoTurns.at(-1)?.text ?? '';
    expect(told).toContain(`delegation ${delegation.id}: stopped, declined`);
    expect(told).toContain('plan it again');
    const rows = await listAutoOutbox({ db, treeId: world.treeId, states: ['pending'] });
    expect(rows).toEqual([]);
    expect(world.errors).toEqual([]);
  });
});
