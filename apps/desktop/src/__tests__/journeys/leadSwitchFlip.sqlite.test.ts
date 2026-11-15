import { describe, expect, it } from 'vitest';
import { publishOfResult } from '@goodboy/core/auto';
import {
  getAutoGrant,
  insertAutoGrantStatement,
  listAutoDelegations,
  setSetting,
  type AutoGrantId,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { flowRulesOf, type FlowRules } from '../../features/work/flowRulesOf';
import { SETTING_WORK_ENABLED } from '../../shared/lib/workSetting';
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

type Position = 'off' | 'on';

const CYCLE: ReadonlyArray<Position> = ['off', 'on', 'off'];
const WORKSPACE = { workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }) };
const SESSION = { sessionId: AUTO_SEED_SESSION };
const NEED = 'I need nock 14.0.1 to stub the host.';

type MatrixRow = readonly [name: string, key: keyof FlowRules, off: unknown, on: unknown];

const SWITCH_MATRIX: ReadonlyArray<MatrixRow> = [
  ['sidebar', 'hasWorkSection', false, true],
  ['the word', 'word', 'Auto', 'Lead'],
  ['start target', 'shouldStartOpenComposer', false, true],
  ['start label', 'startLabel', 'Start a run', 'Start work'],
  ['autonomy control', 'autonomyControl', 'level-chip', 'rows-panel'],
  ['permission rows', 'hasPermissionRows', false, true],
  ['a message while agents work', 'isMessageDeliveredAtOnce', false, true],
  ['the Lead closes its own work', 'canLeadCloseItsWork', false, true],
  ['a saved place on Work', 'savedPlaceOnWork', 'board', 'work'],
];

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

type FlipParams = WorldParams & {
  readonly position: Position;
};

const flip = async ({ world, position }: FlipParams) => {
  await setSetting(
    world.state.world.db,
    SETTING_WORK_ENABLED,
    position === 'on' ? 'true' : 'false',
  );
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
  await setSetting(db, SETTING_WORK_ENABLED, 'false');
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

describe('the switch matrix through a full flip cycle', () => {
  it.each(SWITCH_MATRIX)('%s reads off, on, off', (_name, key, off, on) => {
    const values = CYCLE.map((position) => flowRulesOf({ isWork: position === 'on' })[key]);
    expect(values).toEqual([off, on, off]);
  });
});

describe('the switch rehearsal with three asks pending', () => {
  it('keeps a push ask, a dependency ask and a restricted start through off, on, off', async () => {
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
    for (const position of CYCLE) {
      await flip({ world, position });
      seen.push(await factsOf({ world }));
    }

    expect(seen).toEqual([pending, pending, pending]);
    expect(world.errors).toEqual([]);
  });

  it('answers each ask once after the cycle, and nothing starts or pushes twice', async () => {
    const world = await threeAsksWorld();
    for (const position of CYCLE) {
      await flip({ world, position });
    }
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

  it('keeps a start the workspace default held while on, when the switch goes off before it starts', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target: SESSION, level: 'run' });
    await setSetting(db, SETTING_WORK_ENABLED, 'true');
    await setDefaultRow({ world, change: { key: 'startReaders', value: 'ask' } });
    await userSays({ world, id: 'outbox-acme', text: 'read the notify-relay retries' });
    await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
    await autoTurnEnds({ world });
    expect((await delegationsOf({ world }))[0]?.state).toBe('awaiting_confirm');

    await flip({ world, position: 'off' });

    expect(world.state.ports.childTurns).toEqual([]);
    expect((await delegationsOf({ world }))[0]?.state).toBe('awaiting_confirm');
    expect((await asksOf({ world })).map((ask) => ask.kind)).toEqual(['start']);
  });

  it('asks for a start whose row turned stricter between the proposal and the start', async () => {
    const world = await makeRuntimeWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target: SESSION, level: 'run' });
    await setSetting(db, SETTING_WORK_ENABLED, 'true');
    await userSays({ world, id: 'outbox-acme', text: 'read the notify-relay retries' });
    await autoDelegates({ world, spec: [reader], requestId: 'request-reader' });
    await setDefaultRow({ world, change: { key: 'startReaders', value: 'ask' } });
    await autoTurnEnds({ world });

    expect(world.state.ports.childTurns).toEqual([]);
    expect((await delegationsOf({ world }))[0]?.state).toBe('awaiting_confirm');
    expect((await asksOf({ world })).map((ask) => ask.kind)).toEqual(['start']);
  });
});
