import { describe, expect, it } from 'vitest';
import { publishOfResult } from '@goodboy/core/auto';
import { listAutoDelegations, setSetting } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { readAutoTreeViews } from '../../store/slices/auto-view/readAutoTreeViews';
import { readAdmissionPermissions } from '../../store/runtime/auto/admission/readAdmissionPermissions';
import { createAskAnswerer } from '../../store/runtime/auto/asks/createAskAnswerer';
import { leadAsksOf } from '../../store/runtime/auto/asks/leadAsksOf';
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

const delegationsOf = ({ world }: WorldParams) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const pusher = {
  role: 'implementer',
  task: `add the export to ${LEDGER_MOUNT.mountName}`,
  reason: 'a code change',
  mount: LEDGER_MOUNT.id,
  publish: 'push',
};

const reader = { role: 'scout', task: 'read the notify-relay retries', reason: 'map the callers' };

const rowsOf = async ({ world }: WorldParams) => {
  const db = world.state.world.db;
  const admission = await readAdmissionPermissions({ db, treeId: world.treeId });
  const publish = await readPublishPermissions({ db, treeId: world.treeId });
  return {
    approvePlan: admission.approvePlan,
    startReaders: admission.startReaders,
    startWriters: admission.startWriters,
    push: publish.push,
  };
};

const ownRowsWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  const db = world.state.world.db;
  await setSetting(db, OLD_WORK_SWITCH, 'true');
  await writeAutoLevel({ db, target: SESSION, level: 'step' });
  await setLeadRow({ world, change: { key: 'approvePlan', value: 'skip' } });
  await setLeadRow({ world, change: { key: 'startReaders', value: 'free' } });
  await setLeadRow({ world, change: { key: 'startWriters', value: 'free' } });
  await setLeadRow({ world, change: { key: 'push', value: 'ask' } });
  return world;
};

const pushAskWorld = async (): Promise<RuntimeWorld> => {
  const world = await ownRowsWorld();
  world.state.ports.setMounts([LEDGER_MOUNT]);
  world.state.ports.setSnapshots(LEDGER_MOUNT.worktreePath ?? '', [START, END]);
  await userSays({ world, id: 'outbox-acme', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: { children: [pusher] }, requestId: 'request-push' });
  await autoTurnEnds({ world });
  const push = world.state.ports.childTurns[0];
  await childTurnEnds({
    world,
    index: 0,
    text: `Done.\n<<step-done id="${push?.childAgentId ?? ''}">>`,
  });
  return world;
};

describe('an upgrade from 0.36 with the Work switch on', () => {
  it('keeps the rows a Lead set for itself, whatever the old row says next', async () => {
    const world = await ownRowsWorld();
    const own = { approvePlan: 'skip', startReaders: 'free', startWriters: 'free', push: 'ask' };

    const seen = [await rowsOf({ world })];
    for (const value of ['true', 'false'] as const) {
      await oldSwitchSaid({ world, value });
      seen.push(await rowsOf({ world }));
    }

    expect(seen).toEqual([own, own, own]);
    expect(world.errors).toEqual([]);
  });

  it('starts a reader at once on the Lead row free, with the session level at step', async () => {
    const world = await ownRowsWorld();
    await userSays({ world, id: 'outbox-acme', text: 'read the notify-relay retries' });
    await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
    await autoTurnEnds({ world });

    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(await asksOf({ world })).toEqual([]);
  });

  it('holds a push the Lead row asks for, and answers it once', async () => {
    const world = await pushAskWorld();
    await oldSwitchSaid({ world, value: 'true' });
    const pushRow = (await delegationsOf({ world })).find(
      (delegation) => delegation.requestId === 'request-push',
    );
    expect(publishOfResult({ result: pushRow?.result })?.state).toBe('awaiting_confirm');
    const asks = await asksOf({ world });
    expect(asks.map((ask) => ask.kind)).toEqual(['push']);

    const answer = createAskAnswerer({ runtimeOf: () => world.runtime });
    for (const ask of asks) {
      expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
      expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('settled');
    }
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(await asksOf({ world })).toEqual([]);
    expect(world.errors).toEqual([]);
  });

  it('gives a new Lead the workspace default, not the old switch', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await setSetting(db, OLD_WORK_SWITCH, 'true');
    await writeAutoLevel({ db, target: SESSION, level: 'run' });
    await setDefaultRow({ world, change: { key: 'startReaders', value: 'ask' } });
    await userSays({ world, id: 'outbox-acme', text: 'read the notify-relay retries' });
    await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
    await autoTurnEnds({ world });

    expect(world.state.ports.childTurns).toEqual([]);
    expect((await delegationsOf({ world }))[0]?.state).toBe('awaiting_confirm');
    expect((await asksOf({ world })).map((ask) => ask.kind)).toEqual(['start']);
  });
});
