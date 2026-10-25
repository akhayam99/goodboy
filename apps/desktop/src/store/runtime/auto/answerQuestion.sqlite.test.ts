import { describe, expect, it } from 'vitest';
import {
  getAutoTree,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  listAutoOutbox,
  listAutoReservations,
} from '@goodboy/db';
import {
  autoAnswers,
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

const ASK =
  'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>';

const done = (childAgentId: string, text = 'Finished.') =>
  `${text}\n<<step-done id="${childAgentId}">>`;

const asked = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
  await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
  await autoTurnEnds({ world });
  await childTurnEnds({ world, index: 0, text: ASK });
  return world;
};

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

const questionIdOf = (world: RuntimeWorld): string => {
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('a child was expected');
  }
  return `question-${turn.attemptId}`;
};

const answer = async (world: RuntimeWorld, text = 'Use json lines.') =>
  autoAnswers({
    world,
    delegationId: (await delegationOf(world)).id,
    questionId: questionIdOf(world),
    text,
  });

describe('answering the question of a child', () => {
  it('resumes the same child with the answer in a new attempt once Auto ends its turn', async () => {
    const world = await asked();
    expect(world.state.ports.autoTurns).toHaveLength(2);

    const outcome = await answer(world);

    expect(outcome).toMatchObject({ isOk: true, data: { answered: true, replayed: false } });
    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(await getAutoTree({ db: world.state.world.db, treeId: world.treeId })).toMatchObject({
      phase: 'delegating',
      isYieldRequested: true,
    });
    expect((await delegationOf(world)).state).toBe('starting');

    await autoTurnEnds({ world });

    const turns = world.state.ports.childTurns;
    expect(turns).toHaveLength(2);
    expect(turns[1]?.childAgentId).toBe(turns[0]?.childAgentId);
    expect(turns[1]?.text).toContain('Auto answered the question you asked.');
    expect(turns[1]?.text).toContain('Which export format?');
    expect(turns[1]?.text).toContain('Use json lines.');
    expect(turns[1]?.mountTarget).toEqual(turns[0]?.mountTarget);
    expect(turns[1]?.attemptId).not.toBe(turns[0]?.attemptId);
    const attempts = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: (await delegationOf(world)).id,
    });
    expect(attempts.map((attempt) => [attempt.ordinal, attempt.state])).toEqual([
      [1, 'paused'],
      [2, 'running'],
    ]);
    expect(world.errors).toEqual([]);
  });

  it('hands a provider that does not resume its first brief and where it stopped', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    world.state.ports.setRouting({
      kind: 'ready',
      provider: 'codex',
      model: 'gpt-5',
      effort: 'medium',
      reason: 'a code change',
      proposal: 'none',
    });
    await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
    await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 0, text: ASK });
    const first = world.state.ports.childTurns[0]?.text ?? '';

    await answer(world);
    await autoTurnEnds({ world });

    const resumed = world.state.ports.childTurns[1]?.text ?? '';
    expect(resumed).toContain(first);
    expect(resumed).toContain('add the export');
    expect(resumed).toContain('**Where you stopped** I need a choice.');
    expect(resumed).toContain('Use json lines.');
    expect(world.errors).toEqual([]);
  });

  it('keeps the resume text of a provider that resumes to the question and the answer', async () => {
    const world = await asked();

    await answer(world);
    await autoTurnEnds({ world });

    const resumed = world.state.ports.childTurns[1]?.text ?? '';
    expect(resumed).not.toContain('Your session was not kept');
    expect(resumed).not.toContain('add the export');
    expect(resumed).not.toContain('**Where you stopped**');
  });

  it('keeps the first brief when the answer is replayed or the app restarts before the resume', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    world.state.ports.setRouting({
      kind: 'ready',
      provider: 'codex',
      model: 'gpt-5',
      effort: 'medium',
      reason: 'a code change',
      proposal: 'none',
    });
    await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
    await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 0, text: ASK });
    await answer(world);
    const again = await answer(world);
    expect(again).toMatchObject({ isOk: true, data: { replayed: true } });

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    const resumed = restarted.state.ports.childTurns;
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.text).toContain('add the export');
    expect(resumed[0]?.text).toContain('**Where you stopped** I need a choice.');
    expect(restarted.errors).toEqual([]);
  });

  it('delivers the final result once, counts the resume and reconciles every reservation', async () => {
    const world = await asked();
    await answer(world);
    await autoTurnEnds({ world });
    const resumed = world.state.ports.childTurns[1];
    if (resumed === undefined) {
      throw new Error('a resumed child was expected');
    }

    await childTurnEnds({
      world,
      index: 1,
      text: done(resumed.childAgentId, 'Wrote it as json lines.'),
    });

    const text = world.state.ports.autoTurns.at(-1)?.text ?? '';
    expect(text).toContain('RESULTS FROM YOUR AGENTS');
    expect(text).toContain('Wrote it as json lines.');
    await autoTurnEnds({ world, text: 'Both done.' });
    expect(await delegationOf(world)).toMatchObject({ state: 'settled', outcome: 'completed' });
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    expect(tree).toMatchObject({ attemptsUsed: 2, questionCycles: 1 });
    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(reservations.filter((reservation) => reservation.ownerKind === 'attempt')).toHaveLength(
      2,
    );
    expect(reservations.every((reservation) => reservation.state === 'reconciled')).toBe(true);
    expect(world.errors).toEqual([]);
  });

  it('answers the same question twice with one resume and refuses a different text', async () => {
    const world = await asked();
    await answer(world);

    const again = await answer(world);
    const different = await answer(world, 'Use csv.');

    expect(again).toMatchObject({ isOk: true, data: { replayed: true } });
    expect(different).toMatchObject({ isOk: false, code: 'request_conflict' });
    const attempts = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: (await delegationOf(world)).id,
    });
    expect(attempts).toHaveLength(2);
    await autoTurnEnds({ world });
    expect(world.state.ports.childTurns).toHaveLength(2);
  });

  it('keeps only one resume when two windows answer at the same time', async () => {
    const world = await asked();
    const delegationId = (await delegationOf(world)).id;
    const args = {
      delegation: delegationId,
      question: questionIdOf(world),
      text: 'Use json lines.',
    };

    const [first, second] = await Promise.all([
      autoCommand({ world, verb: 'answer', args }),
      autoCommand({ world, verb: 'answer', args }),
    ]);

    expect([first.isOk, second.isOk]).toEqual([true, true]);
    const attempts = await listAutoAttemptsOfDelegation({ db: world.state.world.db, delegationId });
    expect(attempts).toHaveLength(2);
  });

  it('refuses a delegation, a question or a state it cannot answer', async () => {
    const world = await asked();
    const delegationId = (await delegationOf(world)).id;

    expect(
      await autoAnswers({ world, delegationId: 'delegation-nope', questionId: 'q', text: 'x' }),
    ).toMatchObject({ isOk: false, code: 'delegation_unknown' });
    expect(
      await autoAnswers({ world, delegationId, questionId: 'question-nope', text: 'x' }),
    ).toMatchObject({ isOk: false, code: 'question_unknown' });
    expect(
      await autoCommand({ world, verb: 'answer', args: { delegation: delegationId } }),
    ).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(
      await autoAnswers({
        world,
        delegationId,
        questionId: questionIdOf(world),
        text: 'x',
        runId: 'run-old',
      }),
    ).toMatchObject({ isOk: false, code: 'not_deciding' });
    expect((await delegationOf(world)).state).toBe('paused');
  });

  it('refuses a second answer once the child finished, whatever the text', async () => {
    const world = await asked();
    await answer(world);
    await autoTurnEnds({ world });
    const resumed = world.state.ports.childTurns[1];
    if (resumed === undefined) {
      throw new Error('a resumed child was expected');
    }
    await childTurnEnds({ world, index: 1, text: done(resumed.childAgentId) });

    const late = await answer(world, 'Use csv.');

    expect(late).toMatchObject({ isOk: false, code: 'request_conflict' });
    const other = await autoAnswers({
      world,
      delegationId: (await delegationOf(world)).id,
      questionId: 'question-other',
      text: 'x',
    });
    expect(other).toMatchObject({ isOk: false, code: 'question_unknown' });
  });

  it('refuses the resume when the budget is spent and leaves the child paused', async () => {
    const world = await asked();
    await world.state.world.db.execute('UPDATE auto_trees SET cap_usd = 0.01');

    const outcome = await answer(world);

    expect(outcome).toMatchObject({ isOk: false, code: 'budget' });
    expect((await delegationOf(world)).state).toBe('paused');
    const attempts = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: (await delegationOf(world)).id,
    });
    expect(attempts.map((attempt) => attempt.state)).toEqual(['paused']);
  });

  it('refuses the resume of a stopped tree', async () => {
    const world = await asked();
    await world.state.world.db.execute(`UPDATE auto_trees SET stop_state = 'requested'`);

    expect(await answer(world)).toMatchObject({ isOk: false, code: 'tree_stopped' });
    expect((await delegationOf(world)).state).toBe('paused');
  });

  it('drops a question row Auto never saw when the answer comes first', async () => {
    const world = await asked();
    const rows = await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId });
    expect(rows.map((row) => [row.kind, row.state])).toEqual([
      ['user', 'accepted'],
      ['question', 'accepted'],
    ]);
    await world.state.world.db.execute(
      `UPDATE auto_outbox SET state = 'pending', claimed_by = NULL WHERE kind = 'question'`,
    );

    await answer(world);

    const after = await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId });
    expect(after.find((row) => row.kind === 'question')).toMatchObject({
      state: 'dropped',
      droppedReason: 'answered',
    });
  });
});

describe('answering a question across a restart', () => {
  it('resumes the child once when the app restarts after the answer, before Auto ends its turn', async () => {
    const world = await asked();
    const run = world.state.ports.autoTurns.at(-1)?.runId ?? '';
    await answer(world);

    world.state.ports.liveRuns.delete(run);
    world.state.ports.runOutcomes.set(run, {
      assistantText: 'Answered.',
      exit: 'ok',
      costUsd: 0.05,
    });
    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.childTurns).toHaveLength(1);
    expect(restarted.state.ports.childTurns[0]?.text).toContain('Use json lines.');
    expect((await delegationOf(world)).state).toBe('running');
    expect(restarted.errors).toEqual([]);
  });

  it('keeps watching the resumed child after a restart and joins its result', async () => {
    const world = await asked();
    await answer(world);
    await autoTurnEnds({ world });
    const resumed = world.state.ports.childTurns[1];
    if (resumed === undefined) {
      throw new Error('a resumed child was expected');
    }
    world.state.ports.liveRuns.delete(resumed.runId);
    world.state.ports.runOutcomes.set(resumed.runId, {
      assistantText: done(resumed.childAgentId, 'Wrote it as json lines.'),
      exit: 'ok',
      costUsd: 0.2,
    });

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(await delegationOf(world)).toMatchObject({ state: 'settled', outcome: 'completed' });
    expect(restarted.state.ports.autoTurns.at(-1)?.text).toContain('Wrote it as json lines.');
    expect(restarted.state.ports.childTurns).toHaveLength(0);
  });

  it('delivers a question that was still pending at the restart exactly once', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
    await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world });
    world.state.ports.setAutoTurnFailure(new Error('provider unavailable'));
    await childTurnEnds({ world, index: 0, text: ASK });
    const before = world.state.ports.autoTurns.length;
    const questions = await listAutoOutbox({
      db: world.state.world.db,
      treeId: world.treeId,
      states: ['pending', 'claimed'],
    });
    expect(questions.some((row) => row.kind === 'question')).toBe(true);

    const restarted = restartedWorld({ world });
    restarted.state.ports.setAutoTurnFailure(null);
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.autoTurns).toHaveLength(1);
    expect(restarted.state.ports.autoTurns[0]?.text).toContain('Which export format?');
    expect(before).toBe(world.state.ports.autoTurns.length);
  });
});
