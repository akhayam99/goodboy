import { describe, expect, it, vi } from 'vitest';
import { AUTO_CHECK_TIMEOUT_MS, type MountSnapshot } from '@goodboy/core';
import { listAutoAttemptsOfDelegation, listAutoDelegations } from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import type { AutoCheckScript } from './ports';
import { makeGate } from './testing/makeGate';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const LEDGER_PATH = '/work/harborline/ledger-core';

const TYPECHECK: AutoCheckScript = { id: 'typecheck-id', name: 'typecheck' };
const LINT: AutoCheckScript = { id: 'lint-id', name: 'lint' };

const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

const CLEAN: MountSnapshot = { head: 'abc123', entries: [], isPartial: false };
const DIRTY: MountSnapshot = {
  head: 'abc123',
  entries: [{ path: 'src/export.ts', hash: 'h1' }],
  isPartial: false,
};

type EndParams = {
  readonly checks: ReadonlyArray<AutoCheckScript>;
  readonly snapshots?: ReadonlyArray<MountSnapshot>;
  readonly configure?: (world: RuntimeWorld) => void;
};

const endWriter = async ({
  checks,
  snapshots = [CLEAN],
  configure,
}: EndParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'add the export' });
  world.state.ports.setSnapshots(LEDGER_PATH, snapshots);
  world.state.ports.setChecks(checks);
  configure?.(world);
  await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
  await autoTurnEnds({ world });
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('a child was expected');
  }
  await childTurnEnds({
    world,
    index: 0,
    text: `Done.\n<<step-done id="${turn.childAgentId}">>`,
  });
  return world;
};

const resultOf = async (world: RuntimeWorld) => {
  const [delegation] = await listAutoDelegations({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  if (delegation === undefined) {
    throw new Error('a delegation was expected');
  }
  return delegation;
};

const digestOf = (world: RuntimeWorld): string => world.state.ports.autoTurns[1]?.text ?? '';

describe('checking a writer with the scripts the user ticked', () => {
  it('reads green when every ticked script passes', async () => {
    const world = await endWriter({ checks: [TYPECHECK, LINT] });

    const delegation = await resultOf(world);
    expect(delegation.outcome).toBe('completed');
    expect(world.state.ports.checkRuns.map((run) => run.check.name)).toEqual(['typecheck', 'lint']);
    expect(world.state.ports.checkRuns[0]?.timeoutMs).toBe(AUTO_CHECK_TIMEOUT_MS);
    expect(JSON.stringify(delegation.result)).toContain('"verdict":"green"');
    expect(JSON.stringify(delegation.result)).toContain('"source":"harness"');
    expect(digestOf(world)).toContain('Checks green: typecheck, lint');
  });

  it('reads red, names the script and still completes the delegation', async () => {
    const world = await endWriter({
      checks: [TYPECHECK, LINT],
      configure: (made) => made.state.ports.setCheckResult('typecheck-id', 'fail'),
    });

    expect((await resultOf(world)).outcome).toBe('completed');
    expect(digestOf(world)).toContain('Checks red: typecheck');
  });

  it('reads not checked when a script timed out', async () => {
    const world = await endWriter({
      checks: [TYPECHECK],
      configure: (made) => made.state.ports.setCheckResult('typecheck-id', 'timed_out'),
    });

    expect(digestOf(world)).toContain('Not checked: timed out');
    expect(digestOf(world)).not.toContain('Checks green');
  });

  it('reads not checked, never green, when a script could not run', async () => {
    const world = await endWriter({
      checks: [TYPECHECK],
      configure: (made) => made.state.ports.setCheckResult('typecheck-id', new Error('no shell')),
    });

    expect(digestOf(world)).toContain('Not checked: the checks could not run');
    expect(world.errors).toEqual([]);
  });

  it('reads not checked when nothing is ticked', async () => {
    const world = await endWriter({ checks: [] });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(digestOf(world)).toContain('Not checked: no scripts are ticked as Auto checks');
  });

  it('reads not checked, naming the script, when a ticked script is not on the branch', async () => {
    const world = await endWriter({
      checks: [TYPECHECK],
      configure: (made) => made.state.ports.setMissingChecks(['lint']),
    });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(digestOf(world)).toContain('Not checked: not on this branch: lint');
    expect(digestOf(world)).not.toContain('Checks green');
  });

  it('reads not checked and runs nothing on a tree with uncommitted changes', async () => {
    const world = await endWriter({ checks: [TYPECHECK], snapshots: [CLEAN, DIRTY] });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(digestOf(world)).toContain('Not checked: the tree has uncommitted changes');
  });

  it('reads not checked when the tree moved while the scripts ran', async () => {
    const world = await endWriter({
      checks: [TYPECHECK],
      snapshots: [CLEAN, CLEAN, CLEAN, { ...CLEAN, head: 'def456' }],
    });

    expect(world.state.ports.checkRuns).toHaveLength(1);
    expect(digestOf(world)).toContain('Not checked: the tree changed while the checks ran');
  });

  it('checks nothing when the tree moved off the end commit while the checks waited', async () => {
    const world = await endWriter({
      checks: [TYPECHECK],
      snapshots: [CLEAN, CLEAN, { ...CLEAN, head: 'def456' }],
    });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(JSON.stringify((await resultOf(world)).result)).toContain('"commit":"abc123"');
    expect(digestOf(world)).toContain('Not checked: the tree changed while the checks ran');
  });

  it('records the checked commit in the result', async () => {
    const world = await endWriter({ checks: [TYPECHECK] });

    expect(JSON.stringify((await resultOf(world)).result)).toContain('"commit":"abc123"');
  });

  it('never checks a read-only role', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'look at the export' });
    world.state.ports.setChecks([TYPECHECK]);
    await autoDelegates({
      world,
      spec: { children: [{ role: 'scout', task: 'find callers', reason: 'read only search' }] },
    });
    await autoTurnEnds({ world });
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({
      world,
      index: 0,
      text: `Found.\n<<step-done id="${turn.childAgentId}">>`,
    });

    expect(world.state.ports.checkLists).toEqual([]);
    expect(world.state.ports.checkRuns).toEqual([]);
  });
});

const timedOut = (made: RuntimeWorld): void =>
  made.state.ports.setCheckResult('typecheck-id', 'timed_out');

const attemptSnapshotOf = async (world: RuntimeWorld): Promise<string> => {
  const delegation = await resultOf(world);
  const attempts = await listAutoAttemptsOfDelegation({
    db: world.state.world.db,
    delegationId: delegation.id,
  });
  return JSON.stringify(attempts.at(-1)?.resultSnapshot);
};

describe('running the checks of a writer again', () => {
  it('turns a timeout into green and writes it to the result and the attempt', async () => {
    const world = await endWriter({ checks: [TYPECHECK], configure: timedOut });
    world.state.ports.setCheckResult('typecheck-id', 'pass');
    const delegation = await resultOf(world);

    const outcome = await world.runtime.rerunChecks(delegation.id);

    expect(outcome).toEqual({ kind: 'rerun', verdict: 'green' });
    const after = await resultOf(world);
    expect(after.outcome).toBe('completed');
    expect(JSON.stringify(after.result)).toContain('"verdict":"green"');
    expect(JSON.stringify(after.result)).not.toContain('timed_out');
    expect(await attemptSnapshotOf(world)).toContain('"verdict":"green"');
  });

  it('can be run once more after a red verdict', async () => {
    const world = await endWriter({
      checks: [TYPECHECK],
      configure: (made) => made.state.ports.setCheckResult('typecheck-id', 'fail'),
    });
    const delegation = await resultOf(world);

    const first = await world.runtime.rerunChecks(delegation.id);
    world.state.ports.setCheckResult('typecheck-id', 'pass');
    const second = await world.runtime.rerunChecks(delegation.id);

    expect(first).toEqual({ kind: 'rerun', verdict: 'red' });
    expect(second).toEqual({ kind: 'rerun', verdict: 'green' });
    expect(JSON.stringify((await resultOf(world)).result)).toContain('"verdict":"green"');
  });

  it('refuses when the branch moved after the agent finished and keeps the verdict', async () => {
    const world = await endWriter({ checks: [TYPECHECK], configure: timedOut });
    const delegation = await resultOf(world);
    world.state.ports.setSnapshots(LEDGER_PATH, [{ ...CLEAN, head: 'later99' }]);

    const outcome = await world.runtime.rerunChecks(delegation.id);

    expect(outcome.kind).toBe('refused');
    expect(JSON.stringify((await resultOf(world)).result)).toContain('"reason":"timed_out"');
  });

  it('refuses and keeps the verdict when the tree is dirty now', async () => {
    const world = await endWriter({ checks: [TYPECHECK], configure: timedOut });
    const delegation = await resultOf(world);
    world.state.ports.setSnapshots(LEDGER_PATH, [DIRTY]);

    const outcome = await world.runtime.rerunChecks(delegation.id);

    expect(outcome.kind).toBe('refused');
    expect(JSON.stringify((await resultOf(world)).result)).toContain('"reason":"timed_out"');
  });

  it('has nothing to run again when no script was ticked', async () => {
    const world = await endWriter({ checks: [] });

    const outcome = await world.runtime.rerunChecks((await resultOf(world)).id);

    expect(outcome).toEqual({
      kind: 'refused',
      message: 'This agent has no checks to run again.',
    });
  });

  it('refuses a delegation that is not there', async () => {
    const world = await endWriter({ checks: [TYPECHECK] });

    const outcome = await world.runtime.rerunChecks(
      brandId<AutoDelegationId>({ value: 'delegation-gone' }),
    );

    expect(outcome.kind).toBe('refused');
  });

  it('runs two reruns of the same repo one after the other', async () => {
    const world = await endWriter({ checks: [TYPECHECK], configure: timedOut });
    const delegation = await resultOf(world);
    world.state.ports.setCheckResult('typecheck-id', 'pass');
    const gate = makeGate();
    world.state.ports.setCheckGate(gate.promise);
    const listsBefore = world.state.ports.checkLists.length;

    const first = world.runtime.rerunChecks(delegation.id);
    const second = world.runtime.rerunChecks(delegation.id);
    await vi.waitFor(() =>
      expect(world.state.ports.checkLists.length).toBeGreaterThan(listsBefore),
    );
    expect(world.state.ports.checkLists.length).toBe(listsBefore + 1);
    gate.open();
    await Promise.all([first, second]);

    expect(world.state.ports.checkLists.length).toBe(listsBefore + 2);
  });

  it('drops a rerun that finishes after the delegation moved to another generation', async () => {
    const world = await endWriter({ checks: [TYPECHECK], configure: timedOut });
    const delegation = await resultOf(world);
    world.state.ports.setCheckResult('typecheck-id', 'pass');
    const gate = makeGate();
    world.state.ports.setCheckGate(gate.promise);

    const pending = world.runtime.rerunChecks(delegation.id);
    await vi.waitFor(() => expect(world.state.ports.checkRuns.length).toBeGreaterThan(1));
    await world.state.world.db.execute(
      'UPDATE auto_delegations SET generation = generation + 1 WHERE id = ?',
      [delegation.id],
    );
    gate.open();

    expect((await pending).kind).toBe('refused');
    expect(JSON.stringify((await resultOf(world)).result)).toContain('"reason":"timed_out"');
  });
});
