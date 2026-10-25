import { describe, expect, it, vi } from 'vitest';
import { publishOfResult, type MountSnapshot, type ResultPublish } from '@goodboy/core';
import { listAutoAttemptsOfDelegation, listAutoDelegations } from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import type { AutoCheckScript } from './ports';
import { publishQueue } from './publishQueue';
import { makeGate } from './testing/makeGate';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const LEDGER_PATH = '/work/harborline/ledger-core';
const NOTIFY_PATH = '/work/harborline/notify-relay';

const TYPECHECK: AutoCheckScript = { id: 'typecheck-id', name: 'typecheck' };

const START: MountSnapshot = { head: 'base000', entries: [], isPartial: false };
const END: MountSnapshot = { head: 'abc123', entries: [], isPartial: false };

const STALE = 'The online copy changed. Check again before force pushing.';

type PublishSpec = string | Readonly<Record<string, unknown>>;

const implementer = ({ publish, mount }: { publish: PublishSpec; mount: string }) => ({
  role: 'implementer',
  task: `rewrite the history of ${mount}`,
  reason: 'a code change',
  mount,
  publish,
});

type EndParams = {
  readonly publishes: ReadonlyArray<Readonly<{ publish: PublishSpec; mount: string }>>;
  readonly checks?: ReadonlyArray<AutoCheckScript>;
  readonly configure?: (world: RuntimeWorld) => void;
};

const settle = async ({ publishes, checks = [], configure }: EndParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'tidy the history and push it' });
  world.state.ports.setChecks(checks);
  world.state.ports.setSnapshots(LEDGER_PATH, [START, END]);
  world.state.ports.setSnapshots(NOTIFY_PATH, [START, END]);
  configure?.(world);
  const outcome = await autoDelegates({
    world,
    spec: { children: publishes.map((one) => implementer(one)) },
  });
  if (!outcome.isOk) {
    throw new Error(`the delegate was refused: ${outcome.error ?? ''}`);
  }
  await autoTurnEnds({ world });
  for (const [index, turn] of world.state.ports.childTurns.entries()) {
    await childTurnEnds({
      world,
      index,
      text: `Done.\n<<step-done id="${turn.childAgentId}">>`,
    });
  }
  return world;
};

const delegationsOf = async (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const recordOf = async (world: RuntimeWorld, index = 0): Promise<ResultPublish> => {
  const delegation = (await delegationsOf(world))[index];
  const record = publishOfResult({ result: delegation?.result });
  if (record === null) {
    throw new Error('a publish record was expected');
  }
  return record;
};

const idsOf = async (world: RuntimeWorld): Promise<ReadonlyArray<AutoDelegationId>> =>
  (await delegationsOf(world)).map((delegation) => delegation.id);

const digestOf = (world: RuntimeWorld): string => world.state.ports.autoTurns[1]?.text ?? '';

const LEDGER_PUSH = { publish: 'push', mount: 'mount-ledger-core' };
const LEDGER_FORCE = { publish: 'force', mount: 'mount-ledger-core' };
const NOTIFY_FORCE = { publish: 'force', mount: 'mount-notify-relay' };

describe('pushing the branch of a writer after its work', () => {
  it('pushes the checked commit and says so to Auto', async () => {
    const world = await settle({ publishes: [LEDGER_PUSH], checks: [TYPECHECK] });

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.pushes[0]).toMatchObject({
      worktreePath: LEDGER_PATH,
      branch: 'ak/ledger-export',
      sha: 'abc123',
      isForce: false,
    });
    expect(await recordOf(world)).toMatchObject({ state: 'pushed', mode: 'push', tries: 1 });
    expect(digestOf(world)).toContain('Pushed ak/ledger-export at abc123');
    expect(world.errors).toEqual([]);
  });

  it('keeps the delegation completed and the push held while the checks are red', async () => {
    const world = await settle({
      publishes: [LEDGER_PUSH],
      checks: [TYPECHECK],
      configure: (made) => made.state.ports.setCheckResult('typecheck-id', 'fail'),
    });

    expect((await delegationsOf(world))[0]?.outcome).toBe('completed');
    expect(world.state.ports.pushes).toEqual([]);
    expect(await recordOf(world)).toMatchObject({
      state: 'failed',
      message: 'the checks are red',
      isRetryable: true,
    });
    expect(digestOf(world)).toContain('Not pushed: the checks are red');
  });

  it('pushes after the checks turn green on a rerun and the user retries', async () => {
    const world = await settle({
      publishes: [LEDGER_PUSH],
      checks: [TYPECHECK],
      configure: (made) => made.state.ports.setCheckResult('typecheck-id', 'fail'),
    });
    const [delegationId] = await idsOf(world);
    if (delegationId === undefined) {
      throw new Error('a delegation was expected');
    }
    const early = await world.runtime.publish({ act: 'retry', delegationIds: [delegationId] });
    world.state.ports.setCheckResult('typecheck-id', 'pass');
    await world.runtime.rerunChecks(delegationId);
    const later = await world.runtime.publish({ act: 'retry', delegationIds: [delegationId] });

    expect(early.rows[0]?.state).toBe('failed');
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(later.rows[0]).toMatchObject({ state: 'pushed' });
    expect(await recordOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('pushes when no script is ticked, the gate is the agent word and a clean finish', async () => {
    const world = await settle({ publishes: [LEDGER_PUSH] });

    expect(await recordOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('marks it pushed when the push fails to answer but the read back shows the commit online', async () => {
    const world = await settle({
      publishes: [LEDGER_PUSH],
      configure: (made) => {
        made.state.ports.setPushOutcomes([{ kind: 'failed', message: 'connection reset' }]);
        made.state.ports.setRemoteReads(LEDGER_PATH, [
          { kind: 'sha', branch: 'ak/ledger-export', sha: 'remote111' },
          { kind: 'sha', branch: 'ak/ledger-export', sha: 'remote111' },
          { kind: 'sha', branch: 'ak/ledger-export', sha: 'remote111' },
          { kind: 'sha', branch: 'ak/ledger-export', sha: 'abc123' },
        ]);
      },
    });

    expect(await recordOf(world)).toMatchObject({ state: 'pushed', message: null });
  });

  it('offers one retry after an uncertain failure and stops after that', async () => {
    const world = await settle({
      publishes: [LEDGER_PUSH],
      configure: (made) =>
        made.state.ports.setPushOutcomes([
          { kind: 'failed', message: 'connection reset' },
          { kind: 'failed', message: 'connection reset again' },
        ]),
    });
    const [delegationId] = await idsOf(world);
    if (delegationId === undefined) {
      throw new Error('a delegation was expected');
    }
    expect(await recordOf(world)).toMatchObject({
      state: 'failed',
      message: 'connection reset',
      isRetryable: true,
      tries: 1,
    });

    const retried = await world.runtime.publish({ act: 'retry', delegationIds: [delegationId] });
    const again = await world.runtime.publish({ act: 'retry', delegationIds: [delegationId] });

    expect(retried.rows[0]).toMatchObject({ state: 'failed', message: 'connection reset again' });
    expect(again.rows[0]?.state).toBe('refused');
    expect(world.state.ports.pushes).toHaveLength(2);
  });

  it('retries into a push when the second try succeeds', async () => {
    const world = await settle({
      publishes: [LEDGER_PUSH],
      configure: (made) =>
        made.state.ports.setPushOutcomes([{ kind: 'failed', message: 'connection reset' }]),
    });
    const [delegationId] = await idsOf(world);
    if (delegationId === undefined) {
      throw new Error('a delegation was expected');
    }

    const retried = await world.runtime.publish({ act: 'retry', delegationIds: [delegationId] });

    expect(retried.rows[0]).toMatchObject({ state: 'pushed' });
    expect(await recordOf(world)).toMatchObject({ state: 'pushed', tries: 2 });
  });

  it('writes the record to the result and to the attempt', async () => {
    const world = await settle({ publishes: [LEDGER_PUSH] });
    const delegation = (await delegationsOf(world))[0];
    if (delegation === undefined) {
      throw new Error('a delegation was expected');
    }
    const attempts = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: delegation.id,
    });

    expect(JSON.stringify(attempts.at(-1)?.resultSnapshot)).toContain('"state":"pushed"');
  });

  it('refuses a publish on a role that never commits work', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'look' });

    const outcome = await autoDelegates({
      world,
      spec: {
        children: [{ role: 'scout', task: 'find callers', reason: 'read only', publish: 'push' }],
      },
    });

    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(world.state.ports.childTurns).toEqual([]);
  });

  it('refuses a publish on a scribe, which Goodboy already opens as a pull request', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'open the pull request' });

    const outcome = await autoDelegates({
      world,
      spec: {
        children: [{ role: 'scribe', task: 'write the pr', reason: 'text', publish: 'push' }],
      },
    });

    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
  });
});

type EndUnsettledParams = {
  readonly world: RuntimeWorld;
};

const endWithoutWaiting = ({ world }: EndUnsettledParams): void => {
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('a child turn was expected');
  }
  turn.onEnded({
    treeId: turn.treeId,
    generation: turn.generation,
    delegationId: turn.delegationId,
    attemptId: turn.attemptId,
    runId: turn.runId,
    childAgentId: turn.childAgentId,
    sessionId: turn.sessionId,
    assistantText: `Done.\n<<step-done id="${turn.childAgentId}">>`,
    exit: 'ok',
    costUsd: 0.2,
    filesTouched: [],
    durationMs: 1_000,
  });
};

const delegatedOnly = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'tidy the history and push it' });
  world.state.ports.setChecks([TYPECHECK]);
  world.state.ports.setSnapshots(LEDGER_PATH, [START, END]);
  await autoDelegates({ world, spec: { children: [implementer(LEDGER_PUSH)] } });
  await autoTurnEnds({ world });
  return world;
};

const attemptPublishOf = async (world: RuntimeWorld): Promise<unknown> => {
  const [delegation] = await delegationsOf(world);
  if (delegation === undefined) {
    return null;
  }
  const attempts = await listAutoAttemptsOfDelegation({
    db: world.state.world.db,
    delegationId: delegation.id,
  });
  const snapshot = attempts.at(-1)?.resultSnapshot;
  return typeof snapshot === 'object' && snapshot !== null && 'envelope' in snapshot
    ? publishOfResult({ result: snapshot.envelope })
    : null;
};

const bumpGeneration = async (world: RuntimeWorld): Promise<void> => {
  await world.state.world.db.execute(
    'UPDATE auto_trees SET generation = generation + 1 WHERE id = ?',
    [world.treeId],
  );
};

describe('pushing only after the attempt settled and still owns its tree', () => {
  it('pushes nothing when the work restarted while the checks ran', async () => {
    const world = await delegatedOnly();
    const gate = makeGate();
    world.state.ports.setCheckGate(gate.promise);

    endWithoutWaiting({ world });
    await vi.waitFor(() => expect(world.state.ports.checkRuns.length).toBeGreaterThan(0));
    await bumpGeneration(world);
    gate.open();
    await world.runtime.settled();

    expect(world.state.ports.pushes).toEqual([]);
  });

  it('pushes nothing and offers a retry when the work restarted between the settle and the push', async () => {
    const world = await delegatedOnly();
    const held = makeGate();
    const holding = publishQueue.run({ key: LEDGER_PATH, task: () => held.promise });

    endWithoutWaiting({ world });
    await vi.waitFor(async () =>
      expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushing' }),
    );
    await bumpGeneration(world);
    held.open();
    await holding;
    await world.runtime.settled();

    expect(world.state.ports.pushes).toEqual([]);
    expect(await attemptPublishOf(world)).toMatchObject({
      state: 'failed',
      isRetryable: true,
      isConfirmed: false,
    });
  });

  it('pushes nothing when the tree was stopped between the settle and the push', async () => {
    const world = await delegatedOnly();
    const held = makeGate();
    const holding = publishQueue.run({ key: LEDGER_PATH, task: () => held.promise });

    endWithoutWaiting({ world });
    await vi.waitFor(async () =>
      expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushing' }),
    );
    await world.state.world.db.execute(
      "UPDATE auto_trees SET stop_state = 'requested' WHERE id = ?",
      [world.treeId],
    );
    held.open();
    await holding;
    await world.runtime.settled();

    expect(world.state.ports.pushes).toEqual([]);
  });

  it('pushes a settled push that waited when Goodboy closed, from the window that recovers it', async () => {
    const world = await delegatedOnly();
    const held = makeGate();
    void publishQueue.run({ key: LEDGER_PATH, task: () => held.promise });
    endWithoutWaiting({ world });
    await vi.waitFor(async () =>
      expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushing' }),
    );

    const restarted = restartedWorld({ world });
    held.open();
    await world.runtime.settled();
    expect(world.state.ports.pushes).toEqual([]);
    await world.state.world.db.execute(
      `UPDATE auto_attempts SET result_snapshot_json = json_set(result_snapshot_json,
        '$.envelope.verified.publish.state', 'pushing',
        '$.envelope.verified.publish.isRetryable', json('false'),
        '$.envelope.verified.publish.message', NULL)`,
      [],
    );
    world.state.world.clock.advance({ ms: 31_000 });
    expect(await restarted.runtime.recover(world.treeId)).toBe(true);
    await restarted.runtime.settled();

    expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushed' });
    expect(restarted.state.ports.pushes).toHaveLength(1);
    expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('offers a retry for a push that was under way when Goodboy closed', async () => {
    const world = await settle({ publishes: [LEDGER_PUSH] });
    await world.state.world.db.execute(
      `UPDATE auto_attempts SET result_snapshot_json = json_set(result_snapshot_json,
        '$.envelope.verified.publish.state', 'pushing')`,
      [],
    );

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.pushes).toEqual([]);
    expect(await attemptPublishOf(world)).toMatchObject({
      state: 'failed',
      isRetryable: true,
      message: expect.stringContaining('Goodboy closed while it was pushing'),
    });
  });
});

describe('force pushing the branch of a writer, with a backup and one confirm', () => {
  it('keeps a backup of the online copy and of the start, records the lease and waits', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });

    expect(world.state.ports.pushes).toEqual([]);
    expect(world.state.ports.backups).toEqual([
      { worktreePath: LEDGER_PATH, branch: 'ak/ledger-export', sha: 'remote111' },
      { worktreePath: LEDGER_PATH, branch: 'ak/ledger-export', sha: 'base000' },
    ]);
    expect(await recordOf(world)).toMatchObject({
      state: 'awaiting_confirm',
      mode: 'force',
      sha: 'abc123',
      leaseSha: 'remote111',
      isConfirmed: false,
    });
    expect(digestOf(world)).toContain(
      'Waiting for you to confirm the force push of ak/ledger-export',
    );
  });

  it('pushes the checked commit with the lease pinned to the start sha after the confirm', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });

    const result = await world.runtime.publish({
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toEqual([
      expect.objectContaining({
        worktreePath: LEDGER_PATH,
        branch: 'ak/ledger-export',
        isForce: true,
        leaseSha: 'remote111',
      }),
    ]);
    expect(await recordOf(world)).toMatchObject({ state: 'pushed', isConfirmed: true });
  });

  it('shows the shipped sentence when the lease is lost and checks again before asking anew', async () => {
    const world = await settle({
      publishes: [LEDGER_FORCE],
      configure: (made) => made.state.ports.setPushOutcomes([{ kind: 'stale', message: STALE }]),
    });

    const result = await world.runtime.publish({
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'failed', message: STALE });
    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
    world.state.ports.setRemoteReads(LEDGER_PATH, [
      { kind: 'sha', branch: 'ak/ledger-export', sha: 'remote222' },
    ]);
    const retried = await world.runtime.publish({
      act: 'retry',
      delegationIds: await idsOf(world),
    });
    expect(retried.rows[0]?.state).toBe('awaiting_confirm');
    expect(await recordOf(world)).toMatchObject({ leaseSha: 'remote222', sha: 'abc123' });
    expect(world.state.ports.backups.at(-2)).toMatchObject({ sha: 'remote222' });
    expect(world.state.ports.pushes).toHaveLength(1);

    await world.runtime.publish({ act: 'confirm', delegationIds: await idsOf(world) });
    expect(world.state.ports.pushes.at(-1)).toMatchObject({ sha: 'abc123', leaseSha: 'remote222' });
  });

  it('retries a held force push with the commit of the attempt, not the head of now', async () => {
    const world = await settle({
      publishes: [LEDGER_FORCE],
      configure: (made) =>
        made.state.ports.setCommittedFiles(LEDGER_PATH, new Error('diff unavailable')),
    });
    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
    world.state.ports.setSnapshots(LEDGER_PATH, [{ ...END, head: 'later99' }]);
    world.state.ports.setCommittedFiles(LEDGER_PATH, []);

    const retried = await world.runtime.publish({
      act: 'retry',
      delegationIds: await idsOf(world),
    });

    expect(retried.rows[0]?.state).toBe('awaiting_confirm');
    expect(await recordOf(world)).toMatchObject({ sha: 'abc123' });
  });

  it('pushes nothing when the user declines and keeps the backup', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });

    const result = await world.runtime.publish({
      act: 'decline',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'declined' });
    expect(world.state.ports.pushes).toEqual([]);
    expect(world.state.ports.backups).toHaveLength(2);
    expect(await recordOf(world)).toMatchObject({ state: 'declined' });
  });

  it('answers each of two branches on its own with one confirm', async () => {
    const world = await settle({
      publishes: [LEDGER_FORCE, NOTIFY_FORCE],
      configure: (made) =>
        made.state.ports.setPushOutcomes([{ kind: 'pushed' }, { kind: 'stale', message: STALE }]),
    });

    const result = await world.runtime.publish({
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows.map((row) => row.state)).toEqual(['pushed', 'failed']);
    expect((await recordOf(world, 0)).state).toBe('pushed');
    expect((await recordOf(world, 1)).state).toBe('failed');
    expect(world.state.ports.pushes).toHaveLength(2);
  });

  it('does not push twice when the confirm is sent again after the push worked', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const delegationIds = await idsOf(world);
    await world.runtime.publish({ act: 'confirm', delegationIds });

    const again = await world.runtime.publish({ act: 'confirm', delegationIds });

    expect(again.rows[0]?.state).toBe('refused');
    expect(world.state.ports.pushes).toHaveLength(1);
  });

  it('reads it back when the result was not saved and the commit is already online', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    world.state.ports.setRemoteReads(LEDGER_PATH, [
      { kind: 'sha', branch: 'ak/ledger-export', sha: 'abc123' },
    ]);

    const result = await world.runtime.publish({
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toEqual([]);
  });

  it('force pushes the checked commit, not where the branch went after the checks', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    world.state.ports.setSnapshots(LEDGER_PATH, [{ ...END, head: 'later99' }]);

    const result = await world.runtime.publish({
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toEqual([
      expect.objectContaining({ sha: 'abc123', isForce: true, leaseSha: 'remote111' }),
    ]);
  });

  it('refuses a force push of work that changes files unless the brief says so', async () => {
    const changed = await settle({
      publishes: [LEDGER_FORCE],
      configure: (made) => made.state.ports.setCommittedFiles(LEDGER_PATH, ['src/export.ts']),
    });
    const allowed = await settle({
      publishes: [{ publish: { mode: 'force', changesContent: true }, mount: 'mount-ledger-core' }],
      configure: (made) => made.state.ports.setCommittedFiles(LEDGER_PATH, ['src/export.ts']),
    });

    expect(await recordOf(changed)).toMatchObject({ state: 'failed', isRetryable: false });
    expect((await recordOf(changed)).message).toContain('The brief did not say the files change');
    expect(changed.state.ports.backups).toEqual([]);
    expect(await recordOf(allowed)).toMatchObject({ state: 'awaiting_confirm' });
  });

  it('keeps no backup and offers no put back when the branch was not online at the start', async () => {
    const world = await settle({
      publishes: [LEDGER_FORCE],
      configure: (made) =>
        made.state.ports.setRemoteReads(LEDGER_PATH, [
          { kind: 'absent', branch: 'ak/ledger-export' },
        ]),
    });
    await world.runtime.publish({ act: 'confirm', delegationIds: await idsOf(world) });

    const putBack = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(world.state.ports.backups).toEqual([]);
    expect(world.state.ports.pushes[0]).toMatchObject({ sha: 'abc123', leaseSha: null });
    expect(await recordOf(world)).toMatchObject({ state: 'pushed', backupRef: null });
    expect(putBack.rows[0]?.state).toBe('refused');
  });

  it('refuses a force push when the online copy was not read at the start', async () => {
    const world = await settle({
      publishes: [LEDGER_FORCE],
      configure: (made) => made.state.ports.setRemoteReads(LEDGER_PATH, [{ kind: 'unknown' }]),
    });

    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: false });
    expect(world.state.ports.backups).toEqual([]);
  });

  it('refuses a force push when no backup could be kept', async () => {
    const world = await settle({
      publishes: [LEDGER_FORCE],
      configure: (made) => made.state.ports.setBackupFailure(new Error('disk full')),
    });

    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
    expect((await recordOf(world)).message).toContain(
      'a backup of the online copy could not be kept',
    );
    expect(world.state.ports.pushes).toEqual([]);
  });

  it('refuses a confirm for a delegation that is gone and pushes nothing', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });

    const result = await world.runtime.publish({
      act: 'confirm',
      delegationIds: [brandId<AutoDelegationId>({ value: 'delegation-gone' })],
    });

    expect(result.rows[0]).toMatchObject({ state: 'refused' });
    expect(world.state.ports.pushes).toEqual([]);
  });
});

describe('putting a force push back', () => {
  const pushed = async (): Promise<RuntimeWorld> => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await world.runtime.publish({ act: 'confirm', delegationIds: await idsOf(world) });
    world.state.ports.setSnapshots(LEDGER_PATH, [END]);
    return world;
  };

  it('pushes the online commit it backed up with the lease on the pushed sha, then the local branch', async () => {
    const world = await pushed();

    const result = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'put_back', message: null });
    expect(world.state.ports.pushes.at(-1)).toMatchObject({
      sha: 'remote111',
      isForce: true,
      leaseSha: 'abc123',
    });
    expect(world.state.ports.restores).toEqual([
      expect.objectContaining({ branch: 'ak/ledger-export', expectedHead: 'abc123' }),
    ]);
    expect(await recordOf(world)).toMatchObject({ state: 'put_back' });
  });

  it('puts the online copy back and leaves a local branch that moved since the push', async () => {
    const world = await pushed();
    world.state.ports.setSnapshots(LEDGER_PATH, [{ ...END, head: 'later99' }]);

    const result = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({
      state: 'put_back',
      message: 'The local branch was left as it is: it moved after the push.',
    });
    expect(world.state.ports.restores).toEqual([]);
    expect(world.state.ports.pushes.at(-1)).toMatchObject({ sha: 'remote111' });
  });

  it('says so on the card when the online copy is back but the files cannot be moved here', async () => {
    const world = await pushed();
    world.state.ports.setRestoreOutcome({ kind: 'blocked', message: 'The branch has 2 files.' });

    const result = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({
      state: 'put_back',
      message: 'The local branch was left as it is: The branch has 2 files.',
    });
    expect(world.state.ports.pushes).toHaveLength(2);
  });

  it('changes nothing, online or here, when the push back loses its lease', async () => {
    const world = await pushed();
    world.state.ports.setPushOutcomes([{ kind: 'stale', message: STALE }]);

    const result = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]?.message).toContain('Nothing was put back, online or here');
    expect(world.state.ports.restores).toEqual([]);
    expect((await recordOf(world)).state).toBe('pushed');
  });

  it('keeps put back on offer after a push back that failed offline', async () => {
    const world = await pushed();
    world.state.ports.setPushOutcomes([{ kind: 'failed', message: 'offline' }]);
    world.state.ports.setRemoteReads(LEDGER_PATH, [
      { kind: 'sha', branch: 'ak/ledger-export', sha: 'abc123' },
    ]);

    const first = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });
    const second = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(first.rows[0]?.state).toBe('refused');
    expect(second.rows[0]).toMatchObject({ state: 'put_back' });
    expect(world.state.ports.restores).toHaveLength(1);
  });

  it('reads it back when the push back fails to answer but the backup is online', async () => {
    const world = await pushed();
    world.state.ports.setPushOutcomes([{ kind: 'failed', message: 'connection reset' }]);
    world.state.ports.setRemoteReads(LEDGER_PATH, [
      { kind: 'sha', branch: 'ak/ledger-export', sha: 'remote111' },
    ]);

    const result = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'put_back' });
  });

  it('offers no put back for a plain push', async () => {
    const world = await settle({ publishes: [LEDGER_PUSH] });

    const result = await world.runtime.publish({
      act: 'put_back',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]?.state).toBe('refused');
    expect(world.state.ports.restores).toEqual([]);
  });
});
