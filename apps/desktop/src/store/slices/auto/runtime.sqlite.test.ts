import { describe, expect, it } from 'vitest';
import {
  getAutoAttempt,
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoOutbox,
  listAutoReservations,
} from '@goodboy/db';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';
import { addOutboxRow } from './testing/deliveryWorld';
import { EMPTY_USER_FACTS } from '@goodboy/core';

const TWO_WRITERS = {
  children: [
    {
      role: 'implementer',
      task: 'add the export to ledger-core',
      reason: 'a change to the code',
      mount: 'mount-ledger-core',
    },
    {
      role: 'docs',
      task: 'document the export in notify-relay',
      reason: 'the docs change',
      mount: 'mount-notify-relay',
    },
  ],
};

const done = (childAgentId: string, text = 'Finished.') =>
  `${text}\n<<step-done id="${childAgentId}">>`;

const started = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: TWO_WRITERS });
  await autoTurnEnds({ world });
  return world;
};

const phaseOf = async (world: RuntimeWorld) =>
  (await getAutoTree({ db: world.state.world.db, treeId: world.treeId }))?.phase;

const BANNER = {
  id: 'attachment-banner',
  kind: 'image',
  fileName: 'banner-wide.png',
  mimeType: 'image/png',
  relPath: 'attachments/banner-wide.png',
  dir: '/scratch/session-harborline',
};

describe('images the user gave Auto', () => {
  it('reach Auto and every child it starts from that message, never dropped', async () => {
    const world = await makeRuntimeWorld();
    await addOutboxRow({
      world: world.state.world,
      id: 'outbox-user-images',
      kind: 'user',
      payload: {
        kind: 'user',
        text: 'The banner overlaps the totals on narrow screens, see both shots.',
        facts: EMPTY_USER_FACTS,
        images: [BANNER],
      },
    });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();
    await autoDelegates({ world, spec: TWO_WRITERS });
    await autoTurnEnds({ world });

    expect(world.state.ports.autoTurns[0]?.images).toEqual([BANNER]);
    expect(world.state.ports.childTurns.map((turn) => turn.images)).toEqual([[BANNER], [BANNER]]);
  });
});

describe('the whole round trip of a delegation', () => {
  it('starts the children only after the Auto turn ended, each with its role, mount and kickoff', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
    await autoDelegates({ world, spec: TWO_WRITERS });

    expect(world.state.ports.childTurns).toHaveLength(0);
    expect(await phaseOf(world)).toBe('delegating');

    await autoTurnEnds({ world });

    const turns = world.state.ports.childTurns;
    expect(turns.map((turn) => turn.role).sort()).toEqual(['docs', 'implementer']);
    expect(turns.every((turn) => turn.captureMode === 'new')).toBe(true);
    expect(turns.find((turn) => turn.role === 'implementer')?.mountTarget).toEqual({
      mountId: 'mount-ledger-core',
      mountRevision: 3,
      worktreePath: '/work/harborline/ledger-core',
    });
    expect(turns[0]?.text).toContain('You were started by Auto and report back to Auto.');
    expect(world.state.ports.ensuredChildren).toHaveLength(2);
    expect(await phaseOf(world)).toBe('waiting');
    const attempts = await listAutoAttemptsOfTree({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(attempts.map((attempt) => attempt.state)).toEqual(['running', 'running']);
    expect(attempts.every((attempt) => attempt.runId !== null)).toBe(true);
    expect(world.errors).toEqual([]);
  });

  it('holds the results until the whole batch is done, then delivers them once as one turn', async () => {
    const world = await started();
    const [first, second] = world.state.ports.childTurns;
    if (first === undefined || second === undefined) {
      throw new Error('two children were expected');
    }

    await childTurnEnds({ world, index: 0, text: done(first.childAgentId, 'Added the export.') });

    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).toHaveLength(
      1,
    );
    expect(await phaseOf(world)).toBe('waiting');

    await childTurnEnds({ world, index: 1, text: done(second.childAgentId, 'Documented it.') });

    expect(world.state.ports.autoTurns).toHaveLength(2);
    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('RESULTS FROM YOUR AGENTS');
    expect(text).toContain('Added the export.');
    expect(text).toContain('Documented it.');
    expect(await phaseOf(world)).toBe('deciding');
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((delegation) => [delegation.state, delegation.outcome])).toEqual([
      ['settled', 'completed'],
      ['settled', 'completed'],
    ]);
    expect(world.errors).toEqual([]);
  });

  it('ends in done once Auto answers without more work, with every reservation reconciled', async () => {
    const world = await started();
    for (const [index, turn] of world.state.ports.childTurns.entries()) {
      await childTurnEnds({ world, index, text: done(turn.childAgentId) });
    }

    await autoTurnEnds({ world, text: 'Both changes are in. Here is the summary.' });

    expect(await phaseOf(world)).toBe('done');
    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(reservations.every((reservation) => reservation.state === 'reconciled')).toBe(true);
    expect(world.errors).toEqual([]);
  });

  it('reports a declared block and a missing closing line as what they are', async () => {
    const world = await started();
    const [first, second] = world.state.ports.childTurns;
    if (first === undefined || second === undefined) {
      throw new Error('two children were expected');
    }

    await childTurnEnds({
      world,
      index: 0,
      text: `Cannot build.\n<<step-done id="${first.childAgentId}" status="blocked">>`,
    });
    await childTurnEnds({ world, index: 1, text: 'I think that is done, trust me.' });

    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain(': blocked, declared_blocked');
    expect(text).toContain(': failed, no_closing_envelope');
    expect(text).toContain('it did not close its work with the closing line');
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((delegation) => delegation.outcome)).toEqual(['blocked', 'failed']);
  });

  it('settles a child whose kickoff was refused as failed and still joins the batch', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
    world.state.ports.setChildOutcome({
      kind: 'refused',
      reason: 'kickoff_failed',
      message: 'the branch mount changed before the turn could start',
    });
    await autoDelegates({ world, spec: TWO_WRITERS });
    await autoTurnEnds({ world });

    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain(': failed, kickoff_failed');
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((delegation) => delegation.outcome)).toEqual(['failed', 'failed']);
    expect(await phaseOf(world)).toBe('deciding');
  });

  it('settles a child whose writer lease stayed busy as failed with that reason', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
    world.state.ports.setChildOutcome({
      kind: 'refused',
      reason: 'lease_busy',
      message: 'waiting for the writer',
    });
    await autoDelegates({ world, spec: { children: [TWO_WRITERS.children[0]] } });
    await autoTurnEnds({ world });

    expect(world.state.ports.autoTurns[1]?.text).toContain(': failed, lease_busy');
  });

  it('counts a child end that arrives twice once', async () => {
    const world = await started();
    const first = world.state.ports.childTurns[0];
    if (first === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({ world, index: 0, text: done(first.childAgentId) });
    await childTurnEnds({ world, index: 0, text: done(first.childAgentId) });

    const attempt = await getAutoAttempt({ db: world.state.world.db, attemptId: first.attemptId });
    expect(attempt).toMatchObject({ state: 'ended', outcome: 'completed' });
    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(reservations.filter((reservation) => reservation.state === 'reconciled')).toHaveLength(
      2,
    );
    expect(world.errors).toEqual([]);
  });

  it('drops the end of a child from a generation the tree has left', async () => {
    const world = await started();
    const first = world.state.ports.childTurns[0];
    if (first === undefined) {
      throw new Error('a child was expected');
    }
    await world.state.world.db.execute(`UPDATE auto_trees SET generation = 2`);

    await childTurnEnds({ world, index: 0, text: done(first.childAgentId) });

    const attempt = await getAutoAttempt({ db: world.state.world.db, attemptId: first.attemptId });
    expect(attempt?.state).toBe('running');
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });
});
