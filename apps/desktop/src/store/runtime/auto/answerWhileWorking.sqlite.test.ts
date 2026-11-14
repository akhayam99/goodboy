import { describe, expect, it } from 'vitest';
import { getAutoTree, listAutoDelegations, listAutoOutbox, setSetting } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../shared/lib/workSetting';
import { readAutoTreeViews } from '../../slices/auto-view/readAutoTreeViews';
import { addUserRow } from './testing/deliveryWorld';
import { WORLD_TREE } from './testing/autoWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const SCOUTS = [
  { role: 'scout', task: 'find the export callers', reason: 'read only search' },
  { role: 'scout', task: 'find the retry config', reason: 'read only search' },
];

const NOTE_ID = 'outbox-note-1';

const NOTE = 'also cover the batch endpoint';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

type WorkParams = {
  readonly isWork: boolean;
};

const workingWorld = async ({ isWork }: WorkParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await setSetting(world.state.world.db, SETTING_WORK_ENABLED, isWork ? 'true' : 'false');
  await userSays({ world, id: 'outbox-user-1', text: 'look at the ledger export' });
  await autoDelegates({ world, spec: { children: SCOUTS } });
  await autoTurnEnds({ world });
  return world;
};

type NoteParams = {
  readonly world: RuntimeWorld;
};

const sendNote = async ({ world }: NoteParams): Promise<void> => {
  await addUserRow({
    world: world.state.world,
    id: NOTE_ID,
    text: NOTE,
    atMs: world.state.world.clock.now() + 5,
  });
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

const runningCount = async ({ world }: NoteParams): Promise<number> =>
  (await listAutoDelegations({ db: world.state.world.db, treeId: WORLD_TREE })).filter(
    (delegation) => delegation.state === 'running',
  ).length;

const rowsOf = async ({ world }: NoteParams) =>
  listAutoOutbox({ db: world.state.world.db, treeId: WORLD_TREE });

type MentionParams = {
  readonly worlds: ReadonlyArray<RuntimeWorld>;
  readonly text: string;
};

const turnsMentioning = ({ worlds, text }: MentionParams): number =>
  worlds.flatMap((world) => world.state.ports.autoTurns).filter((turn) => turn.text.includes(text))
    .length;

describe('a note sent while agents work, with the switch on', () => {
  it('is delivered before the agents settle and both keep running', async () => {
    const world = await workingWorld({ isWork: true });
    expect(await runningCount({ world })).toBe(2);

    await sendNote({ world });

    expect(turnsMentioning({ worlds: [world], text: NOTE })).toBe(1);
    expect(await runningCount({ world })).toBe(2);
    const note = (await rowsOf({ world })).find((row) => String(row.id) === NOTE_ID);
    expect(note?.state).toBe('accepted');
    expect(world.errors).toEqual([]);
  });

  it('reads the note back at the turn that took it', async () => {
    const world = await workingWorld({ isWork: true });
    await sendNote({ world });

    const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: SESSION });
    expect(views[0]?.pendingMessages).toEqual([]);
    expect(views[0]?.readMessages).toEqual([
      expect.objectContaining({ rowId: NOTE_ID, text: NOTE, turn: 2 }),
    ]);
  });

  it('delivers agents that settle during the Lead turn in the next turn, once', async () => {
    const world = await workingWorld({ isWork: true });
    await sendNote({ world });
    const turnsBefore = world.state.ports.autoTurns.length;
    const [first, second] = world.state.ports.childTurns;
    if (first === undefined || second === undefined) {
      throw new Error('two children were expected');
    }

    await childTurnEnds({
      world,
      index: 0,
      text: `Found three callers.\n<<step-done id="${first.childAgentId}">>`,
    });
    await childTurnEnds({
      world,
      index: 1,
      text: `The retry window is 30 seconds.\n<<step-done id="${second.childAgentId}">>`,
    });

    expect(world.state.ports.autoTurns).toHaveLength(turnsBefore);
    expect((await getAutoTree({ db: world.state.world.db, treeId: WORLD_TREE }))?.phase).toBe(
      'deciding',
    );

    await autoTurnEnds({ world, text: 'Noted, I will fold it in once they report.' });

    expect(world.state.ports.autoTurns).toHaveLength(turnsBefore + 1);
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain('RESULTS FROM YOUR AGENTS');
    expect(turnsMentioning({ worlds: [world], text: 'Found three callers' })).toBe(1);

    await autoTurnEnds({ world });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(turnsMentioning({ worlds: [world], text: 'Found three callers' })).toBe(1);
    expect(turnsMentioning({ worlds: [world], text: 'The retry window is 30 seconds' })).toBe(1);
    expect(turnsMentioning({ worlds: [world], text: NOTE })).toBe(1);
    expect(await runningCount({ world })).toBe(0);
    expect(world.errors).toEqual([]);
  });

  it('never delivers a note once Stop was pressed', async () => {
    const world = await workingWorld({ isWork: true });
    const turnsBefore = world.state.ports.autoTurns.length;
    await addUserRow({
      world: world.state.world,
      id: NOTE_ID,
      text: NOTE,
      atMs: world.state.world.clock.now() + 5,
    });

    await world.runtime.stop(world.treeId);
    await world.runtime.settled();

    expect(world.state.ports.autoTurns).toHaveLength(turnsBefore);
    const note = (await rowsOf({ world })).find((row) => String(row.id) === NOTE_ID);
    expect(note?.state).not.toBe('accepted');
  });

  it('delivers the note once after the lease passes to another window', async () => {
    const world = await workingWorld({ isWork: true });
    await sendNote({ world });
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('a Lead turn was expected');
    }

    const restarted = restartedWorld({ world });
    restarted.state.ports.liveRuns.delete(turn.runId);
    restarted.state.ports.runOutcomes.set(turn.runId, {
      assistantText: 'Noted.',
      exit: 'ok',
      costUsd: 0.1,
    });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();
    await restarted.runtime.drive(world.treeId);
    await restarted.runtime.settled();

    expect(turnsMentioning({ worlds: [world, restarted], text: NOTE })).toBe(1);
    const accepted = (await rowsOf({ world })).filter(
      (row) => String(row.id) === NOTE_ID && row.state === 'accepted',
    );
    expect(accepted).toHaveLength(1);
    expect(restarted.errors).toEqual([]);
  });
});

describe('a note sent while agents work, with the switch off', () => {
  it('waits for the agents as today', async () => {
    const world = await workingWorld({ isWork: false });

    await sendNote({ world });

    expect(turnsMentioning({ worlds: [world], text: NOTE })).toBe(0);
    const note = (await rowsOf({ world })).find((row) => String(row.id) === NOTE_ID);
    expect(note?.state).toBe('pending');
    const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: SESSION });
    expect(views[0]?.pendingMessages.map((message) => message.rowId)).toEqual([NOTE_ID]);
  });
});
