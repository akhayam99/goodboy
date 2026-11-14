import { describe, expect, it } from 'vitest';
import { publishOfResult, type LeadPermissionValue, type MountSnapshot } from '@goodboy/core/auto';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import { createAskAnswerer } from '../asks/createAskAnswerer';
import { leadAsksOf } from '../asks/leadAsksOf';
import { writeLeadPermission } from '../level/writeLeadPermission';
import type { AutoCheckScript } from '../ports';
import { LEDGER_MOUNT } from '../testing/fakePorts';
import { WORLD_NOW } from '../testing/autoWorld';
import {
  delegationsOf,
  END,
  idsOf,
  implementer,
  LEDGER_PATH,
  LEDGER_PUSH,
  recordOf,
  START,
} from '../testing/publishWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const TYPECHECK: AutoCheckScript = { id: 'typecheck-id', name: 'typecheck' };
const REFUSED_LOCKFILE =
  'it changed pnpm-lock.yaml, which no allowance covers, so its checks did not run and nothing landed';

type Rows = {
  readonly dependencies?: LeadPermissionValue<'dependencies'>;
  readonly protectedFiles?: LeadPermissionValue<'protectedFiles'>;
};

type WorldParams = {
  readonly world: RuntimeWorld;
};

type RowsParams = WorldParams & Rows;

const writeRows = async ({ world, dependencies, protectedFiles }: RowsParams) => {
  const db = world.state.world.db;
  const target = { treeId: world.treeId };
  if (dependencies !== undefined) {
    await writeLeadPermission({
      db,
      target,
      change: { key: 'dependencies', value: dependencies },
      nowMs: WORLD_NOW,
    });
  }
  if (protectedFiles !== undefined) {
    await writeLeadPermission({
      db,
      target,
      change: { key: 'protectedFiles', value: protectedFiles },
      nowMs: WORLD_NOW,
    });
  }
};

type PushParams = Rows & {
  readonly committed: ReadonlyArray<string> | Error;
  readonly hostChanges?: ReadonlyArray<string> | Error;
  readonly isRed?: boolean;
};

const pushedWorld = async ({ committed, hostChanges, isRed = false, ...rows }: PushParams) => {
  const world = await makeRuntimeWorld();
  await writeRows({ world, ...rows });
  await userSays({ world, id: 'outbox-user-1', text: 'add the retries and push them' });
  world.state.ports.setChecks([TYPECHECK]);
  world.state.ports.setSnapshots(LEDGER_PATH, [START, END]);
  world.state.ports.setCommittedFiles(LEDGER_PATH, committed);
  if (hostChanges !== undefined) {
    world.state.ports.setHostChanges(LEDGER_PATH, hostChanges);
  }
  if (isRed) {
    world.state.ports.setCheckResult(TYPECHECK.id, 'fail');
  }
  const outcome = await autoDelegates({ world, spec: { children: [implementer(LEDGER_PUSH)] } });
  if (!outcome.isOk) {
    throw new Error(`the delegate was refused: ${outcome.error ?? ''}`);
  }
  await autoTurnEnds({ world });
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('a child turn was expected');
  }
  await childTurnEnds({ world, index: 0, text: `Done.\n<<step-done id="${turn.childAgentId}">>` });
  return world;
};

const leadTextsOf = ({ world }: WorldParams): ReadonlyArray<string> =>
  world.state.ports.autoTurns.slice(1).map((turn) => turn.text);

describe('the landing backstop at the end of an attempt', () => {
  it('refuses a lockfile changed around the deny rule: no check, no push, one refusal', async () => {
    const world = await pushedWorld({
      dependencies: 'ask',
      committed: ['src/retry.ts', 'pnpm-lock.yaml'],
    });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(world.state.ports.pushes).toEqual([]);
    const [delegation] = await delegationsOf(world);
    expect(delegation).toMatchObject({ outcome: 'failed', reason: REFUSED_LOCKFILE });
    expect(await recordOf(world)).toMatchObject({ state: 'failed' });
    const refusals = leadTextsOf({ world }).filter((text) => text.includes(REFUSED_LOCKFILE));
    expect(refusals).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });

  it('refuses a protected file while its row asks', async () => {
    const world = await pushedWorld({
      protectedFiles: 'ask',
      committed: ['src/retry.ts', '.github/workflows/ci.yml'],
    });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(world.state.ports.pushes).toEqual([]);
    expect((await delegationsOf(world))[0]?.reason).toContain('.github/workflows/ci.yml');
  });

  it('refuses the result when the changed files cannot be read', async () => {
    const world = await pushedWorld({
      dependencies: 'ask',
      committed: new Error('diff unavailable'),
    });

    expect(world.state.ports.checkRuns).toEqual([]);
    expect(world.state.ports.pushes).toEqual([]);
    expect((await delegationsOf(world))[0]).toMatchObject({
      outcome: 'failed',
      reason: 'the changed files could not be read, so its checks did not run and nothing landed',
    });
  });

  it('lands a change the rows cover, with its checks and its push', async () => {
    const world = await pushedWorld({
      dependencies: 'ask',
      protectedFiles: 'ask',
      committed: ['src/retry.ts', 'src/retry.test.ts'],
    });

    expect(world.state.ports.checkRuns).toHaveLength(1);
    expect(world.state.ports.pushes).toHaveLength(1);
    expect((await delegationsOf(world))[0]?.outcome).toBe('completed');
  });

  it('behaves as today when both rows are Allow', async () => {
    const world = await pushedWorld({
      dependencies: 'allow',
      protectedFiles: 'allow',
      committed: ['pnpm-lock.yaml', '.github/workflows/ci.yml'],
    });

    expect(world.state.ports.checkRuns).toHaveLength(1);
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(await recordOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('checks the list again at publish when the row asks by then', async () => {
    const world = await pushedWorld({
      dependencies: 'allow',
      committed: ['src/retry.ts', 'pnpm-lock.yaml'],
      isRed: true,
    });
    const [delegationId] = await idsOf(world);
    if (delegationId === undefined) {
      throw new Error('a delegation was expected');
    }
    await writeRows({ world, dependencies: 'ask' });
    world.state.ports.setCheckResult(TYPECHECK.id, 'pass');
    await world.runtime.rerunChecks(delegationId);
    const retried = await world.runtime.publish({ act: 'retry', delegationIds: [delegationId] });

    expect(world.state.ports.pushes).toEqual([]);
    expect(retried.rows[0]).toMatchObject({ state: 'failed' });
    expect(await recordOf(world)).toMatchObject({
      state: 'failed',
      message: 'it changed pnpm-lock.yaml, which no allowance covers, so nothing was pushed',
      isRetryable: false,
    });
  });
});

const DEPENDENCY_NEED = 'nock 14.0.1: stubs the host in the retry tests';

const TESTER = {
  role: 'tester',
  task: 'cover the payments-api retries',
  reason: 'tests are the work of a tester',
  mount: LEDGER_MOUNT.id,
};

type AllowedParams = {
  readonly child: Readonly<Record<string, unknown>>;
};

const allowedWorld = async ({ child }: AllowedParams) => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  world.state.ports.setMounts([LEDGER_MOUNT]);
  world.state.ports.setChecks([TYPECHECK]);
  world.state.ports.setSnapshots(LEDGER_PATH, [START]);
  world.state.ports.setCommittedFiles(LEDGER_PATH, ['test/retry.test.ts', 'pnpm-lock.yaml']);
  await writeRows({ world, dependencies: 'ask' });
  await userSays({ world, id: 'outbox-user-1', text: 'cover the payments-api retries' });
  const outcome = await autoDelegates({ world, spec: { children: [child] } });
  if (!outcome.isOk) {
    throw new Error(`the delegate was refused: ${outcome.error ?? ''}`);
  }
  await autoTurnEnds({ world });
  return world;
};

type ChildParams = WorldParams & {
  readonly index: number;
  readonly tail: string;
};

const childEnds = async ({ world, index, tail }: ChildParams) => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`child turn ${index} was expected`);
  }
  await childTurnEnds({ world, index, text: tail.replace('ID', turn.childAgentId) });
};

const allowAndRestart = async ({ world }: WorldParams) => {
  await childEnds({
    world,
    index: 0,
    tail: `I stopped before the install.\n<<step-done id="ID" status="returned" needs="dependency">>\n${DEPENDENCY_NEED}`,
  });
  if (world.state.ports.autoTurns.length > 1) {
    await autoTurnEnds({ world, text: 'Waiting for the user.' });
  }
  const views = await readAutoTreeViews({
    db: world.state.world.db,
    sessionId: AUTO_SEED_SESSION,
  });
  const [ask] = views.flatMap((view) => leadAsksOf({ view }));
  if (ask === undefined) {
    throw new Error('a dependency ask was expected');
  }
  const answer = createAskAnswerer({ runtimeOf: () => world.runtime });
  expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
  await world.runtime.settled();
  await autoTurnEnds({ world, text: 'The agent starts again.' });
  world.state.ports.setSnapshots(LEDGER_PATH, [END]);
  await childEnds({ world, index: 1, tail: 'Covered.\n<<step-done id="ID">>' });
};

const retriedOf = async ({ world }: WorldParams) => {
  const retried = (await delegationsOf(world)).find((delegation) => delegation.retryOf !== null);
  if (retried === undefined) {
    throw new Error('a retried delegation was expected');
  }
  return retried;
};

describe('the landing backstop after an allowance', () => {
  it('lands the lockfile of the package the user allowed', async () => {
    const world = await allowedWorld({ child: TESTER });
    await allowAndRestart({ world });

    expect(await retriedOf({ world })).toMatchObject({ outcome: 'completed', reason: null });
    expect(world.state.ports.committedReads.at(-1)).toMatchObject({
      base: 'base000',
      head: 'abc123',
    });
    expect(world.state.ports.checkRuns).toHaveLength(1);
  });

  it('pushes the lockfile of the package the user allowed', async () => {
    const world = await allowedWorld({ child: implementer(LEDGER_PUSH) });
    await writeRows({ world, protectedFiles: 'ask' });
    await allowAndRestart({ world });

    expect(await retriedOf({ world })).toMatchObject({ outcome: 'completed', reason: null });
    expect(world.state.ports.hostReads.at(-1)).toMatchObject({
      branch: 'ak/ledger-export',
      head: 'abc123',
    });
    expect(world.state.ports.pushes).toHaveLength(1);
  });
});

const LATER: MountSnapshot = { head: 'def456', entries: [], isPartial: false };

describe('the landing backstop over what the host would receive', () => {
  it('refuses to push a lockfile a refused attempt left behind, after a clean retry', async () => {
    const world = await pushedWorld({
      dependencies: 'ask',
      committed: ['src/retry.ts', 'pnpm-lock.yaml'],
    });
    const [refused] = await delegationsOf(world);
    if (refused === undefined) {
      throw new Error('the refused delegation was expected');
    }
    world.state.ports.setSnapshots(LEDGER_PATH, [END]);
    const outcome = await autoDelegates({
      world,
      requestId: 'request-retry',
      spec: { children: [{ retryOf: refused.id, reason: 'without the lockfile this time' }] },
    });
    expect(outcome.isOk).toBe(true);
    await autoTurnEnds({ world });
    world.state.ports.setSnapshots(LEDGER_PATH, [LATER]);
    world.state.ports.setCommittedFiles(LEDGER_PATH, ['src/retry.ts']);
    world.state.ports.setHostChanges(LEDGER_PATH, ['src/retry.ts', 'pnpm-lock.yaml']);
    await childEnds({ world, index: 1, tail: 'Done.\n<<step-done id="ID">>' });

    const retried = await retriedOf({ world });
    expect(retried.outcome).toBe('completed');
    expect(world.state.ports.checkRuns).toHaveLength(1);
    expect(world.state.ports.pushes).toEqual([]);
    expect(world.state.ports.hostReads.at(-1)).toMatchObject({ head: 'def456' });
    expect(publishOfResult({ result: retried.result })).toMatchObject({
      state: 'failed',
      message: 'it changed pnpm-lock.yaml, which no allowance covers, so nothing was pushed',
      isRetryable: false,
    });
  });

  it('holds the push and offers a retry when the files to push cannot be listed', async () => {
    const world = await pushedWorld({ dependencies: 'ask', committed: ['src/retry.ts'] });
    expect(world.state.ports.pushes).toHaveLength(1);

    const held = await pushedWorld({
      dependencies: 'ask',
      committed: ['src/retry.ts'],
      hostChanges: new Error('origin is not reachable'),
    });
    expect(held.state.ports.pushes).toEqual([]);
    expect(await recordOf(held)).toMatchObject({
      state: 'failed',
      message:
        'the changed files could not be read, so nothing was pushed (origin is not reachable)',
      isRetryable: true,
    });
  });
});
