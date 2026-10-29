import { describe, expect, it } from 'vitest';
import {
  getAutoTree,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  listAutoReservations,
} from '@goodboy/db';
import { prepareRetry } from './prepareRetry';
import { LEDGER_MOUNT } from './testing/fakePorts';
import {
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

const failedChild = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
  await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
  await autoTurnEnds({ world });
  await childTurnEnds({ world, index: 0, text: 'I could not finish this.' });
  return world;
};

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const firstDelegation = async (world: RuntimeWorld) => {
  const delegation = (await delegationsOf(world)).find((row) => row.retryOf === null);
  if (delegation === undefined) {
    throw new Error('a delegation was expected');
  }
  return delegation;
};

const retryDelegation = async (world: RuntimeWorld) => {
  const delegation = (await delegationsOf(world)).find((row) => row.retryOf !== null);
  if (delegation === undefined) {
    throw new Error('a retry was expected');
  }
  return delegation;
};

const bareRetry = (retryOf: string) => ({
  role: null,
  title: null,
  task: '',
  reason: 'again',
  provider: null,
  model: null,
  effort: null,
  taskType: null,
  difficulty: null,
  doneWhen: null,
  expected: null,
  artifactIds: [],
  mount: null,
  revises: null,
  changeFrom: [],
  publish: null,
  facts: [],
  decisions: [],
  forQuestion: null,
  retryOf,
  shouldConfirm: false,
});

const retry = async (world: RuntimeWorld, extra: Readonly<Record<string, unknown>> = {}) => {
  const original = await firstDelegation(world);
  return autoCommand({
    world,
    verb: 'delegate',
    args: {
      'request-id': 'request-retry',
      spec: JSON.stringify({
        children: [{ retryOf: original.id, reason: 'the build is fixed now', ...extra }],
      }),
    },
  });
};

describe('retrying a delegation that ended without a result', () => {
  it('repeats the work as a new delegation on the same agent, mount and model', async () => {
    const world = await failedChild();
    const original = await firstDelegation(world);
    expect(original).toMatchObject({ state: 'settled', outcome: 'failed' });

    const outcome = await retry(world);

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true } });
    expect(await delegationsOf(world)).toHaveLength(2);
    const repeated = await retryDelegation(world);
    expect(repeated).toMatchObject({
      retryOf: original.id,
      childAgentId: original.childAgentId,
      role: 'implementer',
      state: 'accepted',
    });
    expect(repeated.target).toMatchObject({ mountId: 'mount-ledger-core' });
    expect(repeated.routing).toMatchObject({ provider: 'anthropic', model: 'sonnet' });
    expect(repeated.id).not.toBe(original.id);
    expect(repeated.firstAttemptId).not.toBe(original.firstAttemptId);
  });

  it('starts the retry after the Auto turn ends with a note about the earlier attempt', async () => {
    const world = await failedChild();
    await retry(world);

    await autoTurnEnds({ world });

    const turns = world.state.ports.childTurns;
    expect(turns).toHaveLength(2);
    expect(turns[1]?.childAgentId).toBe(turns[0]?.childAgentId);
    expect(turns[1]?.text).toContain(
      '**Retry** The earlier attempt ended failed (no_closing_envelope).',
    );
    expect(turns[1]?.text).toContain('**Task** add the export');
    expect(turns[1]?.attemptId).not.toBe(turns[0]?.attemptId);
    expect(turns[1]?.mountTarget).toEqual(turns[0]?.mountTarget);
    expect(world.errors).toEqual([]);
  });

  it('counts the retry as a delegation, an attempt and a new reservation', async () => {
    const world = await failedChild();
    await retry(world);

    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    expect(tree).toMatchObject({ delegationsUsed: 2, attemptsUsed: 2 });
    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(reservations.filter((reservation) => reservation.ownerKind === 'attempt')).toHaveLength(
      2,
    );
  });

  it('answers the same request id with the same receipt and one retry', async () => {
    const world = await failedChild();
    const first = await retry(world);

    const again = await retry(world);

    expect(first).toMatchObject({ isOk: true });
    expect(again).toMatchObject({ isOk: true, data: { replayed: true } });
    expect(await delegationsOf(world)).toHaveLength(2);
  });

  it('uses the delivered result as it was, never editing the settled delegation', async () => {
    const world = await failedChild();
    const before = await firstDelegation(world);

    await retry(world);
    await autoTurnEnds({ world });
    const after = await firstDelegation(world);

    expect(after).toMatchObject({
      state: 'settled',
      outcome: 'failed',
      reason: before.reason,
      settledAt: before.settledAt,
    });
    expect(after.result).toEqual(before.result);
  });
});

describe('refusing a retry that cannot repeat the work', () => {
  it('refuses a delegation of another conversation and a retry without a reason', async () => {
    const world = await failedChild();

    expect(
      await autoCommand({
        world,
        verb: 'delegate',
        args: {
          'request-id': 'request-a',
          spec: JSON.stringify([{ retryOf: 'delegation-nope', reason: 'again' }]),
        },
      }),
    ).toMatchObject({ isOk: false, code: 'delegation_unknown' });
    expect(
      await autoCommand({
        world,
        verb: 'delegate',
        args: {
          'request-id': 'request-b',
          spec: JSON.stringify([{ retryOf: (await firstDelegation(world)).id }]),
        },
      }),
    ).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(await delegationsOf(world)).toHaveLength(1);
  });

  it('refuses a retry of an agent that has not finished', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
    await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world });
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    if (tree === null) {
      throw new Error('a tree was expected');
    }

    const outcome = await prepareRetry({
      ctx: world.state.ctx,
      tree,
      child: bareRetry((await firstDelegation(world)).id),
      slot: 0,
    });

    expect(outcome).toMatchObject({ kind: 'refused', refusal: { code: 'retry_unavailable' } });
  });

  it('refuses a retry that also names a role or a task of its own', async () => {
    const world = await failedChild();

    const outcome = await retry(world, { role: 'tester', task: 'something else' });

    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
  });

  it('refuses when the mount of the earlier attempt moved or is gone', async () => {
    const world = await failedChild();
    world.state.ports.setMounts([{ ...LEDGER_MOUNT, worktreePath: '/work/harborline/moved' }]);
    expect(await retry(world)).toMatchObject({ isOk: false, code: 'mount_missing' });

    world.state.ports.setMounts([]);
    expect(await retry(world)).toMatchObject({ isOk: false, code: 'mount_missing' });
    expect(await delegationsOf(world)).toHaveLength(1);
  });

  it('refuses a second retry while the first is still open', async () => {
    const world = await failedChild();
    await retry(world);
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    const original = await firstDelegation(world);
    if (tree === null) {
      throw new Error('a tree was expected');
    }

    const outcome = await prepareRetry({
      ctx: world.state.ctx,
      tree,
      child: bareRetry(original.id),
      slot: 0,
    });

    expect(outcome).toMatchObject({
      kind: 'refused',
      refusal: { code: 'retry_unavailable' },
    });
  });
});

describe('retrying across a restart', () => {
  it('starts the retry once when the window restarts after the retry was accepted', async () => {
    const world = await failedChild();
    await retry(world);
    const run = world.state.ports.autoTurns.at(-1)?.runId ?? '';
    world.state.ports.liveRuns.delete(run);
    world.state.ports.runOutcomes.set(run, {
      assistantText: 'Retrying.',
      exit: 'ok',
      costUsd: 0.05,
    });

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.childTurns).toHaveLength(1);
    expect(restarted.state.ports.childTurns[0]?.text).toContain('**Retry**');
    const attempts = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: (await retryDelegation(world)).id,
    });
    expect(attempts).toHaveLength(1);
  });
});

const LEDGER_PATH = '/work/harborline/ledger-core';
const START = { head: 'start-1', entries: [], isPartial: false };
const STOPPED = { head: 'stopped-2', entries: [], isPartial: false };
const DONE = { head: 'done-3', entries: [], isPartial: false };

const stoppedChild = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  world.state.ports.setSnapshots(LEDGER_PATH, [START, STOPPED, STOPPED]);
  await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
  await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
  await autoTurnEnds({ world });
  await childTurnEnds({
    world,
    index: 0,
    text: 'I wrote half of the export.',
    overrides: { exit: 'cancelled' },
  });
  return world;
};

describe('continuing a child that was stopped', () => {
  it('continues the same agent in the same worktree from where it stopped', async () => {
    const world = await stoppedChild();
    const original = await firstDelegation(world);
    expect(original).toMatchObject({ state: 'settled', outcome: 'stopped' });

    await retry(world);
    await autoTurnEnds({ world });

    const turns = world.state.ports.childTurns;
    expect(turns[1]?.childAgentId).toBe(original.childAgentId);
    expect(turns[1]?.mountTarget).toEqual(turns[0]?.mountTarget);
    expect(turns[1]?.text).toContain('Its work is still in this worktree');
    expect(turns[1]?.text).toContain('Do not start over.');
    expect(turns[1]?.text).not.toContain('Do the work again from the start');
  });

  it('keeps the commits of the stopped attempt in the result of the retry', async () => {
    const world = await stoppedChild();
    await retry(world);
    await autoTurnEnds({ world });
    const repeated = await retryDelegation(world);
    const [attempt] = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: repeated.id,
    });
    expect(attempt?.baseline).toMatchObject({ head: 'start-1' });

    world.state.ports.setSnapshots(LEDGER_PATH, [DONE]);
    world.state.ports.setCommittedFiles(LEDGER_PATH, ['src/export.ts']);
    await childTurnEnds({ world, index: 1, text: 'The export is done.' });

    expect(world.state.ports.committedReads.at(-1)).toMatchObject({
      base: 'start-1',
      head: 'done-3',
    });
    expect(world.errors).toEqual([]);
  });
});
