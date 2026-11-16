import { describe, expect, it } from 'vitest';
import { LEAD_PERMISSION_PRESETS, publishOfResult } from '@goodboy/core/auto';
import {
  getAutoGrant,
  insertAutoGrantStatement,
  listAutoDelegations,
  setSetting,
  type AutoGrantId,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { readAutoTreeViews } from '../../store/slices/auto-view/readAutoTreeViews';
import { readAdmissionPermissions } from '../../store/runtime/auto/admission/readAdmissionPermissions';
import { createAskAnswerer } from '../../store/runtime/auto/asks/createAskAnswerer';
import { leadAsksOf } from '../../store/runtime/auto/asks/leadAsksOf';
import { readIsLeadClosing } from '../../store/runtime/auto/level/readIsLeadClosing';
import { readLaunchPermissions } from '../../store/runtime/auto/level/readLaunchPermissions';
import { readPublishPermissions } from '../../store/runtime/auto/level/readPublishPermissions';
import { writeAutoLevel } from '../../store/runtime/auto/level/writeAutoLevel';
import {
  writeLeadPermission,
  type LeadPermissionChange,
} from '../../store/runtime/auto/level/writeLeadPermission';
import { LEDGER_MOUNT } from '../../store/runtime/auto/testing/fakePorts';
import { END, START } from '../../store/runtime/auto/testing/publishWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../../store/runtime/auto/testing/runtimeWorld';

const OLD_WORK_SWITCH = 'work.enabled';
const WORKSPACE = { workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }) };
const SESSION = { sessionId: AUTO_SEED_SESSION };
const NEED = 'I need nock 14.0.1 to stub the host.';

type WorldParams = {
  readonly world: RuntimeWorld;
};

type RowParams = WorldParams & {
  readonly change: LeadPermissionChange;
};

const setLeadRow = ({ world, change }: RowParams) =>
  writeLeadPermission({
    db: world.state.world.db,
    target: { treeId: world.treeId },
    change,
    nowMs: world.state.world.clock.now(),
  });

const setDefaultRow = ({ world, change }: RowParams) =>
  writeLeadPermission({
    db: world.state.world.db,
    target: WORKSPACE,
    change,
    nowMs: world.state.world.clock.now(),
  });

type SwitchParams = WorldParams & {
  readonly value: 'true' | 'false';
};

const oldSwitchSaid = async ({ world, value }: SwitchParams) => {
  await setSetting(world.state.world.db, OLD_WORK_SWITCH, value);
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

const asksOf = async ({ world }: WorldParams) => {
  const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });
  return views.flatMap((view) => leadAsksOf({ view }));
};

const answererOf = ({ world }: WorldParams) =>
  createAskAnswerer({ runtimeOf: () => world.runtime });

const delegationsOf = ({ world }: WorldParams) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const pusher = {
  role: 'implementer',
  task: `add the export to ${LEDGER_MOUNT.mountName}`,
  reason: 'a code change',
  mount: LEDGER_MOUNT.id,
  publish: 'push',
};

const tester = { role: 'scout', task: 'cover the payments-api retries', reason: 'find the gaps' };
const reader = { role: 'scout', task: 'read the notify-relay retries', reason: 'map the callers' };

const GRANT_ID = brandId<AutoGrantId>({ value: 'grant-nock' });

const threeAsksWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  const db = world.state.world.db;
  world.state.ports.setMounts([LEDGER_MOUNT]);
  world.state.ports.setSnapshots(LEDGER_MOUNT.worktreePath ?? '', [START, END]);
  await setSetting(db, OLD_WORK_SWITCH, 'false');
  await writeAutoLevel({ db, target: SESSION, level: 'run' });
  await setLeadRow({ world, change: { key: 'push', value: 'ask' } });
  await userSays({ world, id: 'outbox-acme', text: 'ship the ledger export' });

  await autoDelegates({ world, spec: { children: [pusher] }, requestId: 'request-push' });
  await autoTurnEnds({ world });
  const push = world.state.ports.childTurns[0];
  await childTurnEnds({
    world,
    index: 0,
    text: `Done.\n<<step-done id="${push?.childAgentId ?? ''}">>`,
  });

  await autoDelegates({ world, spec: [tester], requestId: 'request-tester' });
  await autoTurnEnds({ world });
  await childTurnEnds({ world, index: 1, text: NEED });
  const testerTurn = world.state.ports.childTurns[1];
  if (testerTurn === undefined) {
    throw new Error('Expected the tester to run');
  }
  await db.transaction({
    statements: [
      insertAutoGrantStatement({
        grant: {
          id: GRANT_ID,
          treeId: world.treeId,
          delegationId: testerTurn.delegationId,
          attemptId: testerTurn.attemptId,
          textVersion: null,
          kind: 'dependency',
          subject: 'nock@14.0.1',
          nowMs: world.state.world.clock.now(),
        },
      }),
    ],
  });

  await setLeadRow({ world, change: { key: 'startReaders', value: 'ask' } });
  await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
  await autoTurnEnds({ world });
  return world;
};

type RequestParams = WorldParams & {
  readonly requestId: string;
};

const delegationOf = async ({ world, requestId }: RequestParams) =>
  (await delegationsOf({ world })).find((delegation) => delegation.requestId === requestId);

const factsOf = async ({ world }: WorldParams) => {
  const db = world.state.world.db;
  const pushRow = await delegationOf({ world, requestId: 'request-push' });
  const readerRow = await delegationOf({ world, requestId: 'request-reader' });
  const asks = await asksOf({ world });
  return {
    asks: asks.map((ask) => ask.kind).sort(),
    pushes: world.state.ports.pushes.length,
    childTurns: world.state.ports.childTurns.length,
    pushState: publishOfResult({ result: pushRow?.result })?.state ?? null,
    grant: (await getAutoGrant({ db, grantId: GRANT_ID }))?.state ?? null,
    readerState: readerRow?.state ?? null,
    admission: (await readAdmissionPermissions({ db, treeId: world.treeId })).startReaders,
    publish: (await readPublishPermissions({ db, treeId: world.treeId })).push,
  };
};

describe('an upgrade from 0.36 with the Work switch off', () => {
  it('reads a session level as the preset of the rows, with no stored row', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await setSetting(db, OLD_WORK_SWITCH, 'false');
    await writeAutoLevel({ db, target: SESSION, level: 'step' });

    const step = LEAD_PERMISSION_PRESETS.step;
    expect(await readAdmissionPermissions({ db, treeId: world.treeId })).toEqual({
      approvePlan: step.approvePlan,
      startReaders: step.startReaders,
      startWriters: step.startWriters,
      addProject: step.addProject,
    });
    expect(await readPublishPermissions({ db, treeId: world.treeId })).toEqual({
      push: step.push,
      pullRequest: step.pullRequest,
    });
    expect(await readLaunchPermissions({ db, treeId: world.treeId })).toEqual({
      dependencies: step.dependencies,
      protectedFiles: step.protectedFiles,
    });
    expect(await readIsLeadClosing({ db, treeId: world.treeId })).toBe(false);
  });

  it('keeps a push ask, a dependency ask and a restricted start, whatever the old row says', async () => {
    const world = await threeAsksWorld();
    const pending = {
      asks: ['dependency', 'push', 'start'],
      pushes: 0,
      childTurns: 2,
      pushState: 'awaiting_confirm',
      grant: 'asked',
      readerState: 'awaiting_confirm',
      admission: 'ask',
      publish: 'ask',
    };
    expect(await factsOf({ world })).toEqual(pending);

    const seen = [];
    for (const value of ['true', 'false'] as const) {
      await oldSwitchSaid({ world, value });
      seen.push(await factsOf({ world }));
    }

    expect(seen).toEqual([pending, pending]);
    expect(world.errors).toEqual([]);
  });

  it('answers each ask once, and nothing starts or pushes twice', async () => {
    const world = await threeAsksWorld();
    await oldSwitchSaid({ world, value: 'false' });
    const answer = answererOf({ world });
    const asks = await asksOf({ world });

    for (const ask of asks) {
      expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
      expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('settled');
    }
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.pushes[0]).toMatchObject({ sha: 'abc123', isForce: false });
    expect((await getAutoGrant({ db: world.state.world.db, grantId: GRANT_ID }))?.state).not.toBe(
      'asked',
    );
    const readerRow = await delegationOf({ world, requestId: 'request-reader' });
    expect(readerRow?.state).not.toBe('awaiting_confirm');
    const testerRow = await delegationOf({ world, requestId: 'request-tester' });
    const continued = (await delegationsOf({ world })).filter(
      (delegation) => delegation.retryOf === testerRow?.id,
    );
    const turnsOf = (id: string | undefined) =>
      world.state.ports.childTurns.filter((turn) => turn.delegationId === id).length;
    expect(continued).toHaveLength(1);
    expect([turnsOf(continued[0]?.id), turnsOf(readerRow?.id)]).toEqual([1, 1]);
    expect(await asksOf({ world })).toEqual([]);
  });

  it('holds a start on the workspace default even with the old row off', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target: SESSION, level: 'run' });
    await setSetting(db, OLD_WORK_SWITCH, 'false');
    await setDefaultRow({ world, change: { key: 'startReaders', value: 'ask' } });
    await userSays({ world, id: 'outbox-acme', text: 'read the notify-relay retries' });
    await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
    await autoTurnEnds({ world });

    expect(world.state.ports.childTurns).toEqual([]);
    expect((await delegationsOf({ world }))[0]?.state).toBe('awaiting_confirm');
    expect((await asksOf({ world })).map((ask) => ask.kind)).toEqual(['start']);
  });

  it('asks for a start whose row turned stricter between the proposal and the start', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target: SESSION, level: 'run' });
    await userSays({ world, id: 'outbox-acme', text: 'read the notify-relay retries' });
    await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
    await setDefaultRow({ world, change: { key: 'startReaders', value: 'ask' } });
    await autoTurnEnds({ world });

    expect(world.state.ports.childTurns).toEqual([]);
    expect((await delegationsOf({ world }))[0]?.state).toBe('awaiting_confirm');
    expect((await asksOf({ world })).map((ask) => ask.kind)).toEqual(['start']);
  });
});
