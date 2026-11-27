// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountSnapshot } from '@goodboy/core/auto';
import {
  getAutoTree,
  insertArtifact,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  listAutoReservations,
  replaceAgentQueuedMessages,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type ArtifactId, type IsoDateTime } from '@goodboy/types';
import { finishAttempt } from '../finishAttempt';
import type { RoutingOutcome } from '../ports';
import { CLEAN_SNAPSHOT, LEDGER_MOUNT } from '../testing/fakePorts';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};
const SCOUT = { role: 'scout', task: 'find the export callers', reason: 'read only search' };
const MISSED = 'Added the export to ledger-core.';
const REMINDER = 'This is the only reminder.';

const CODEX_ROUTING: RoutingOutcome = {
  kind: 'ready',
  provider: 'codex',
  model: 'gpt-5.5',
  effort: 'medium',
  reason: 'a standard change fits a mid tier model',
  proposal: 'none',
};

const DIRTY_SNAPSHOT: MountSnapshot = {
  head: 'abc123',
  entries: [{ path: 'src/export.ts', hash: 'hash-1' }],
  isPartial: false,
};

type StartParams = {
  readonly child?: Readonly<Record<string, unknown>>;
  readonly capUsd?: number;
  readonly prepare?: (world: RuntimeWorld) => void;
};

const startWith = async ({ child = IMPLEMENTER, capUsd, prepare }: StartParams = {}) => {
  const world = await makeRuntimeWorld(capUsd === undefined ? {} : { capUsd });
  prepare?.(world);
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: { children: [child] } });
  await autoTurnEnds({ world });
  return world;
};

const turnOf = (world: RuntimeWorld, index: number) => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`child turn ${index} was expected`);
  }
  return turn;
};

const doneText = (world: RuntimeWorld) =>
  `All checks pass.\n<<step-done id="${turnOf(world, 0).childAgentId}">>`;

const delegationOf = async (world: RuntimeWorld) => {
  const [delegation] = await listAutoDelegations({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  if (delegation === undefined) {
    throw new Error('a delegation was expected');
  }
  return delegation;
};

const attemptsOf = async (world: RuntimeWorld) =>
  listAutoAttemptsOfDelegation({
    db: world.state.world.db,
    delegationId: (await delegationOf(world)).id,
  });

const insertChildAgent = async (world: RuntimeWorld, agentId: string) =>
  world.state.world.db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 9, ?, ?)',
    [agentId, AUTO_SEED_SESSION, 'helper', 'running'],
  );

describe('a helper that ends without its closing block', () => {
  it('runs one more turn on the same helper and keeps the Lead asleep', async () => {
    const world = await startWith();

    await childTurnEnds({ world, index: 0, text: MISSED });

    const first = turnOf(world, 0);
    const second = turnOf(world, 1);
    expect(second).toMatchObject({
      childAgentId: first.childAgentId,
      delegationId: first.delegationId,
      mountTarget: first.mountTarget,
    });
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(second.text).toContain(REMINDER);
    expect(second.text).toContain(`<<step-done id="${first.childAgentId}">>`);
    expect(second.text).not.toContain('**Task**');
    expect(await delegationOf(world)).toMatchObject({ state: 'running', outcome: null });
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });

  it('completes once the helper closes and tells the Lead both parts of the report', async () => {
    const world = await startWith();
    await childTurnEnds({ world, index: 0, text: MISSED });

    await childTurnEnds({ world, index: 1, text: doneText(world) });

    expect(await delegationOf(world)).toMatchObject({ outcome: 'completed', reason: null });
    const told = world.state.ports.autoTurns[1]?.text ?? '';
    expect(told).toContain('Added the export to ledger-core.');
    expect(told).toContain('All checks pass.');
    expect(world.errors).toEqual([]);
  });

  it('fails as before on a second miss and sends no third turn', async () => {
    const world = await startWith();
    await childTurnEnds({ world, index: 0, text: MISSED });

    await childTurnEnds({ world, index: 1, text: 'Waiting on the checks.' });

    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(await delegationOf(world)).toMatchObject({
      outcome: 'failed',
      reason: 'no_closing_envelope',
    });
    expect(world.state.ports.autoTurns[1]?.text).toContain(': failed, no_closing_envelope');
  });

  it('drops a late end of the old turn', async () => {
    const world = await startWith();
    await childTurnEnds({ world, index: 0, text: MISSED });

    await childTurnEnds({ world, index: 0, text: doneText(world) });

    expect(await delegationOf(world)).toMatchObject({ state: 'running', outcome: null });
    expect((await attemptsOf(world)).map((attempt) => attempt.state)).toEqual(['ended', 'running']);
    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });

  it('counts the reminder against the limit of the conversation', async () => {
    const world = await startWith();
    await childTurnEnds({ world, index: 0, text: MISSED, overrides: { costUsd: 0.2 } });

    await childTurnEnds({ world, index: 1, text: doneText(world), overrides: { costUsd: 0.3 } });

    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    const spent = reservations
      .filter((reservation) => reservation.ownerKind === 'attempt')
      .map((reservation) => [reservation.state, reservation.actualUsd]);
    expect(spent).toEqual([
      ['reconciled', 0.2],
      ['reconciled', 0.3],
    ]);
    expect(await getAutoTree({ db: world.state.world.db, treeId: world.treeId })).toMatchObject({
      delegationsUsed: 1,
      attemptsUsed: 2,
    });
  });

  it('sends no reminder once the limit is used up', async () => {
    const world = await startWith({ capUsd: 1 });

    await childTurnEnds({ world, index: 0, text: MISSED, overrides: { costUsd: 5 } });

    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(await delegationOf(world)).toMatchObject({
      outcome: 'failed',
      reason: 'no_closing_envelope',
    });
    expect(world.errors).toEqual([]);
  });

  it('sends no reminder to a helper with a message waiting for it', async () => {
    const world = await startWith();
    const agentId = brandId<AgentId>({ value: turnOf(world, 0).childAgentId });
    await insertChildAgent(world, agentId);
    await replaceAgentQueuedMessages(world.state.world.db, {
      agentId,
      messages: [
        {
          id: 'auto-message:note-1',
          agentId,
          content: 'Also cover the notify-relay callers.',
          attachments: [],
          override: null,
          createdAt: brandId<IsoDateTime>({ value: new Date(0).toISOString() }),
        },
      ],
    });

    await childTurnEnds({ world, index: 0, text: MISSED });

    expect(world.state.ports.childTurns).toHaveLength(1);
    expect((await delegationOf(world)).reason).toBe('no_closing_envelope');
  });

  it('sends no reminder after a turn that ended in an error', async () => {
    const world = await startWith();

    await childTurnEnds({ world, index: 0, text: MISSED, overrides: { exit: 'error' } });

    expect(world.state.ports.childTurns).toHaveLength(1);
    expect((await delegationOf(world)).reason).toBe('process_error');
  });

  it('sends no reminder to a helper that is being stopped', async () => {
    const world = await startWith();
    await world.state.world.db.execute('UPDATE auto_delegations SET is_stopping = 1');

    await childTurnEnds({ world, index: 0, text: MISSED });

    expect(world.state.ports.childTurns).toHaveLength(1);
    expect((await delegationOf(world)).state).toBe('settled');
  });

  it('keeps the missed closing and the first report when the reminder cannot start', async () => {
    const world = await startWith();
    world.state.ports.setChildOutcome({
      kind: 'refused',
      reason: 'kickoff_failed',
      message: 'the folder is held by another turn',
    });

    await childTurnEnds({ world, index: 0, text: MISSED });

    expect(await delegationOf(world)).toMatchObject({
      outcome: 'failed',
      reason: 'no_closing_envelope',
    });
    expect(world.state.ports.autoTurns[1]?.text).toContain('Added the export to ledger-core.');
    expect(world.errors).toEqual([]);
  });

  it('keeps the files the first turn changed when the reminder cannot start', async () => {
    const world = await startWith({
      prepare: (state) =>
        state.state.ports.setSnapshots(LEDGER_MOUNT.worktreePath ?? '', [
          CLEAN_SNAPSHOT,
          DIRTY_SNAPSHOT,
        ]),
    });
    world.state.ports.setChildOutcome({
      kind: 'refused',
      reason: 'kickoff_failed',
      message: 'the folder is held by another turn',
    });

    await childTurnEnds({ world, index: 0, text: MISSED });

    expect((await delegationOf(world)).result).toMatchObject({
      outcome: 'failed',
      verified: { changedFiles: [{ path: 'src/export.ts', ownership: 'attempt' }] },
    });
  });

  it('gives the reminder the inputs frozen for the first turn', async () => {
    const world = await startWith();
    await childTurnEnds({ world, index: 0, text: MISSED });

    const [first, reminder] = await attemptsOf(world);
    expect(first?.launchSnapshot).not.toBeNull();
    expect(reminder?.launchSnapshot).toEqual(first?.launchSnapshot);
  });

  it('keeps the first report when the reminder turn is cut short', async () => {
    const world = await startWith();
    await childTurnEnds({ world, index: 0, text: MISSED });

    await childTurnEnds({ world, index: 1, text: '', overrides: { exit: 'error' } });

    expect((await delegationOf(world)).reason).toBe('process_error');
    expect(world.state.ports.autoTurns[1]?.text).toContain('Added the export to ledger-core.');
  });

  it('keeps the files the first turn changed on the result', async () => {
    const world = await startWith({
      prepare: (state) =>
        state.state.ports.setSnapshots(LEDGER_MOUNT.worktreePath ?? '', [
          CLEAN_SNAPSHOT,
          DIRTY_SNAPSHOT,
        ]),
    });
    await childTurnEnds({ world, index: 0, text: MISSED });

    await childTurnEnds({ world, index: 1, text: doneText(world) });

    expect((await delegationOf(world)).result).toMatchObject({
      verified: { changedFiles: [{ path: 'src/export.ts', ownership: 'attempt' }] },
    });
  });

  it('asks a scout for the report it never wrote and completes with it', async () => {
    const world = await startWith({ child: SCOUT });
    await childTurnEnds({ world, index: 0, text: 'Found three callers.' });
    const second = turnOf(world, 1);
    await insertChildAgent(world, second.childAgentId);
    await insertArtifact({
      db: world.state.world.db,
      input: {
        id: brandId<ArtifactId>({ value: 'report-1' }),
        sessionId: AUTO_SEED_SESSION,
        agentId: brandId<AgentId>({ value: second.childAgentId }),
        kind: 'report',
        schemaVersion: 1,
        title: 'Callers of the export',
        sourceFormat: 'markdown',
        sourceText: '## Callers\n\n- ledger-core/export.ts',
        metadata: { reportType: 'session-summary' },
        sourceTurnId: second.runId,
      },
    });

    await childTurnEnds({ world, index: 1, text: doneText(world) });

    expect(second.text).toContain('<<artifact v=1 kind=report>>');
    expect((await delegationOf(world)).outcome).toBe('completed');
    expect(world.state.ports.autoTurns[1]?.text).toContain('artifact report-1 (report)');
  });

  it('gives the brief again to a helper whose provider keeps no session', async () => {
    const world = await startWith({
      prepare: (state) => state.state.ports.setRouting(CODEX_ROUTING),
    });

    await childTurnEnds({ world, index: 0, text: MISSED });

    const text = turnOf(world, 1).text;
    expect(text).toContain('**Task** add the export');
    expect(text).toContain('**Where you stopped** Added the export to ledger-core.');
    expect(text).toContain(REMINDER);
  });

  it('starts the reminder after a restart that came before it could start', async () => {
    const world = await startWith();
    const first = turnOf(world, 0);
    await finishAttempt({
      ctx: world.state.ctx,
      ended: {
        treeId: first.treeId,
        generation: first.generation,
        delegationId: first.delegationId,
        attemptId: first.attemptId,
        runId: first.runId,
        childAgentId: first.childAgentId,
        sessionId: first.sessionId,
        assistantText: MISSED,
        exit: 'ok',
        costUsd: 0.2,
        filesTouched: [],
        durationMs: 1_000,
      },
    });
    const restarted = restartedWorld({ world });

    await restarted.runtime.recover(restarted.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.childTurns.map((turn) => turn.text)).toEqual([
      expect.stringContaining(REMINDER),
    ]);
    expect(restarted.errors).toEqual([]);
  });
});
