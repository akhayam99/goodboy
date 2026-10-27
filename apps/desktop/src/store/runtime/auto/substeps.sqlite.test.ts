import { describe, expect, it } from 'vitest';
import { AUTO_SUBSTEP_PARENT_SLACK_MS, AUTO_SUBSTEPS_PER_PARENT } from '@goodboy/core';
import {
  autoSubstepStatements,
  getAutoDelegation,
  getAutoTree,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
} from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { stopTree } from './stopTree';
import { registerPlan } from './testing/autoWorld';
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

const SCOUT = (task: string) => ({
  role: 'scout',
  task,
  reason: 'reading code is the work of a scout',
});

const ASK_SCOUT =
  'I am stuck.\n<<ctx-question blocking="true" needs="scout">>Where is the retry limit set?<</ctx-question>>';

const ASK_PLAIN = 'I am stuck.\n<<ctx-question blocking="true">>Which file?<</ctx-question>>';

const done = (childAgentId: string, text = 'Found it.') =>
  `${text}\n<<step-done id="${childAgentId}">>`;

type Parent = Readonly<{ delegationId: string; questionId: string }>;

const delegationOf = async (world: RuntimeWorld, id: string) => {
  const delegation = await getAutoDelegation({
    db: world.state.world.db,
    delegationId: brandId<AutoDelegationId>({ value: id }),
  });
  if (delegation === null) {
    throw new Error(`delegation ${id} was expected`);
  }
  return delegation;
};

const allOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const firstParent = (parents: ReadonlyArray<Parent>): Parent => {
  const [parent] = parents;
  if (parent === undefined) {
    throw new Error('a parent was expected');
  }
  return parent;
};

const helpersOf = async (world: RuntimeWorld) =>
  (await allOf(world)).filter((delegation) => delegation.request['parent'] !== undefined);

const plainOf = async (world: RuntimeWorld) =>
  (await allOf(world)).filter((delegation) => delegation.request['parent'] === undefined);

const questionOf = (world: RuntimeWorld, index: number): string => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`child turn ${index} was expected`);
  }
  return `question-${turn.attemptId}`;
};

type PausedParams = {
  readonly count: number;
  readonly ask?: string;
  readonly planIds?: ReadonlyArray<Readonly<{ id: string; agentId: string }>>;
};

const pausedParents = async ({
  count,
  ask = ASK_SCOUT,
  planIds,
}: PausedParams): Promise<Readonly<{ world: RuntimeWorld; parents: ReadonlyArray<Parent> }>> => {
  const world = await makeRuntimeWorld({
    capUsd: 20,
    ...(planIds === undefined ? {} : { planIds, agentIds: planIds.map((plan) => plan.agentId) }),
  });
  await userSays({ world, id: 'outbox-user-1', text: 'find the retry limit in payments-api' });
  await autoDelegates({
    world,
    spec: { children: Array.from({ length: count }, (_, n) => SCOUT(`look at area ${n + 1}`)) },
  });
  await autoTurnEnds({ world });
  for (let index = 0; index < count; index += 1) {
    await childTurnEnds({ world, index, text: ask });
  }
  const delegations = await allOf(world);
  const parents = delegations.map((delegation, index) => ({
    delegationId: String(delegation.id),
    questionId: questionOf(world, index),
  }));
  return { world, parents };
};

const helperFor = (parent: Parent, task = 'find the retry limit') => ({
  ...SCOUT(task),
  forQuestion: parent.questionId,
});

describe('substeps', () => {
  it('admits a scout for each of four paused parents, which no longer hold a slot', async () => {
    const { world, parents } = await pausedParents({ count: 4 });
    expect((await allOf(world)).map((delegation) => delegation.state)).toEqual([
      'paused',
      'paused',
      'paused',
      'paused',
    ]);

    const text = world.state.ports.autoTurns.at(-1)?.text ?? '';
    expect(text).toContain('It asks for a scout');
    expect(text).toContain('one delegation and two attempts');

    const outcome = await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: parents.map((parent) => helperFor(parent)) },
    });

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true } });
    const delegations = await allOf(world);
    expect(delegations).toHaveLength(8);
    const helpers = await helpersOf(world);
    expect(helpers.map((helper) => helper.request['parent'])).toEqual(
      parents.map((parent) => ({ ...parent, depth: 2 })),
    );
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    expect(tree).toMatchObject({ delegationsUsed: 8, attemptsUsed: 8 });
    for (const [index, parent] of parents.entries()) {
      const moved = await delegationOf(world, parent.delegationId);
      const helper = helpers[index];
      expect(moved.deadlineAt).toBeGreaterThanOrEqual(
        (helper?.deadlineAt ?? 0) + AUTO_SUBSTEP_PARENT_SLACK_MS,
      );
    }
    expect(world.errors).toEqual([]);
  });

  it('refuses a substep that does not name a paused question', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const unknown = await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [{ ...SCOUT('x'), forQuestion: 'question-nope' }] },
    });
    expect(unknown).toMatchObject({ isOk: false, code: 'not_paused' });
    const writer = await autoDelegates({
      world,
      requestId: 'request-3',
      spec: {
        children: [
          {
            role: 'implementer',
            task: 'x',
            reason: 'code',
            mount: 'mount-ledger-core',
            forQuestion: parents[0]?.questionId,
          },
        ],
      },
    });
    expect(writer).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(await allOf(world)).toHaveLength(1);
  });

  it('refuses a substep of a substep as a depth cap', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const parent = parents[0];
    if (parent === undefined) {
      throw new Error('a parent was expected');
    }
    await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(parent)] },
    });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 1, text: ASK_PLAIN });
    const helperQuestion = questionOf(world, 1);

    const outcome = await autoDelegates({
      world,
      requestId: 'request-3',
      spec: { children: [{ ...SCOUT('go deeper'), forQuestion: helperQuestion }] },
    });

    expect(outcome).toMatchObject({ isOk: false, code: 'depth_cap' });
    expect(await allOf(world)).toHaveLength(2);
  });

  it('refuses the third substep of one parent, counted across turns and inside one batch', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const parent = parents[0];
    if (parent === undefined) {
      throw new Error('a parent was expected');
    }
    const trio = await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(parent, 'a'), helperFor(parent, 'b'), helperFor(parent, 'c')] },
    });
    expect(trio).toMatchObject({ isOk: false, code: 'substep_cap' });
    expect(await allOf(world)).toHaveLength(1);

    const pair = await autoDelegates({
      world,
      requestId: 'request-3',
      spec: { children: [helperFor(parent, 'a'), helperFor(parent, 'b')] },
    });
    expect(pair).toMatchObject({ isOk: true });
    await autoTurnEnds({ world });
    for (const index of [1, 2]) {
      const turn = world.state.ports.childTurns[index];
      await childTurnEnds({ world, index, text: done(turn?.childAgentId ?? '') });
    }

    const third = await autoDelegates({
      world,
      requestId: 'request-4',
      spec: { children: [helperFor(parent, 'c')] },
    });

    expect(third).toMatchObject({ isOk: false, code: 'substep_cap' });
    expect(await allOf(world)).toHaveLength(3);

    const raced = await world.state.world.db.transaction({
      statements: autoSubstepStatements({
        treeId: world.treeId,
        slot: 0,
        parentDelegationId: brandId<AutoDelegationId>({ value: parent.delegationId }),
        questionId: parent.questionId,
        generation: 1,
        maxSubsteps: AUTO_SUBSTEPS_PER_PARENT,
        parentDeadlineAt: 1,
      }),
    });
    expect(raced).toMatchObject({ status: 'aborted', abortCode: 'admission_substep:0' });
  });

  it('refuses the admit when a user message bumped the generation', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    await world.state.world.db.execute('UPDATE auto_trees SET generation = generation + 1');

    const outcome = await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(firstParent(parents))] },
    });

    expect(outcome).toMatchObject({ isOk: false, code: 'generation_changed' });
    expect(await allOf(world)).toHaveLength(1);
  });

  it('admits a helper only for the question the parent waits on now, after a second pause', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const first = firstParent(parents);
    await autoCommand({
      world,
      verb: 'answer',
      args: { delegation: first.delegationId, question: first.questionId, text: 'In config.' },
    });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 1, text: ASK_SCOUT });
    const second = { delegationId: first.delegationId, questionId: questionOf(world, 1) };

    const stale = await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(first)] },
    });
    const raced = await world.state.world.db.transaction({
      statements: autoSubstepStatements({
        treeId: world.treeId,
        slot: 0,
        parentDelegationId: brandId<AutoDelegationId>({ value: first.delegationId }),
        questionId: first.questionId,
        generation: 1,
        maxSubsteps: AUTO_SUBSTEPS_PER_PARENT,
        parentDeadlineAt: 1,
      }),
    });
    const current = await autoDelegates({
      world,
      requestId: 'request-3',
      spec: { children: [helperFor(second)] },
    });

    expect(stale).toMatchObject({ isOk: false, code: 'not_paused' });
    expect(raced).toMatchObject({ status: 'aborted', abortCode: 'admission_substep:0' });
    expect(current).toMatchObject({ isOk: true });
    expect((await helpersOf(world)).map((helper) => helper.request['parent'])).toEqual([
      { ...second, depth: 2 },
    ]);
  });

  it('does not let Auto retry a parent that is still waiting for its answer', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(firstParent(parents))] },
    });

    const outcome = await autoDelegates({
      world,
      requestId: 'request-3',
      spec: { children: [{ retryOf: parents[0]?.delegationId, reason: 'again' }] },
    });

    expect(outcome).toMatchObject({ isOk: false });
    expect((await delegationOf(world, parents[0]?.delegationId ?? '')).state).toBe('paused');
  });

  it('hands the report of a scout to the paused parent in the answer and resumes it once', async () => {
    const { world, parents } = await pausedParents({
      count: 1,
      planIds: [{ id: 'artifact-report-1', agentId: 'agent-scout-x' }],
    });
    const parent = firstParent(parents);
    await registerPlan({
      world: world.state.world,
      id: 'artifact-report-1',
      agentId: 'agent-scout-x',
    });
    await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(parent)] },
    });
    await autoTurnEnds({ world });
    const helperTurn = world.state.ports.childTurns[1];
    await childTurnEnds({ world, index: 1, text: done(helperTurn?.childAgentId ?? '') });

    const unknown = await autoCommand({
      world,
      verb: 'answer',
      args: {
        delegation: parent.delegationId,
        question: parent.questionId,
        text: 'See the report.',
        artifact: 'artifact-nope',
      },
    });
    expect(unknown).toMatchObject({ isOk: false, code: 'artifact_unknown' });
    expect((await delegationOf(world, parent.delegationId)).state).toBe('paused');

    const answer = {
      delegation: parent.delegationId,
      question: parent.questionId,
      text: 'See the report.',
      artifact: 'artifact-report-1',
    };
    const first = await autoCommand({ world, verb: 'answer', args: answer });
    const again = await autoCommand({ world, verb: 'answer', args: answer });
    expect(first).toMatchObject({ isOk: true, data: { replayed: false } });
    expect(again).toMatchObject({ isOk: true, data: { replayed: true } });
    await autoTurnEnds({ world });

    const resumed = world.state.ports.childTurns.at(-1)?.text ?? '';
    expect(resumed).toContain('See the report.');
    expect(resumed).toContain('**Report handed over**');
    expect(resumed).toContain('Plan for notify-relay (version 1)');
    expect(resumed).toContain('- step one');
    const attempts = await listAutoAttemptsOfDelegation({
      db: world.state.world.db,
      delegationId: brandId<AutoDelegationId>({ value: parent.delegationId }),
    });
    expect(attempts).toHaveLength(2);
    expect(world.errors).toEqual([]);
  });

  it('answers the parent with the failure when the scout failed', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const parent = firstParent(parents);
    await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(parent)] },
    });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 1, text: 'crashed', overrides: { exit: 'error' } });

    const outcome = await autoAnswers({
      world,
      delegationId: parent.delegationId,
      questionId: parent.questionId,
      text: 'The scout failed. Use the default of three retries.',
    });

    expect(outcome).toMatchObject({ isOk: true, data: { answered: true } });
    await autoTurnEnds({ world });
    expect(world.state.ports.childTurns.at(-1)?.text).toContain(
      'Use the default of three retries.',
    );
  });

  it('keeps a paused parent paused while the running slots are full, and resumes it when one frees', async () => {
    const { world, parents } = await pausedParents({ count: 1, ask: ASK_PLAIN });
    const parent = firstParent(parents);
    const fill = await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: ['a', 'b', 'c', 'd'].map((area) => SCOUT(`look at ${area}`)) },
    });
    expect(fill).toMatchObject({ isOk: true });
    const answer = {
      world,
      delegationId: parent.delegationId,
      questionId: parent.questionId,
      text: 'Use the default.',
    };

    const refused = await autoAnswers(answer);

    expect(refused).toMatchObject({ isOk: false, code: 'breadth_cap' });
    expect((await delegationOf(world, parent.delegationId)).state).toBe('paused');
    const firstOpen = (await plainOf(world)).find((row) => row.state !== 'paused');
    await world.state.world.db.execute(
      `UPDATE auto_delegations SET state = 'settled', outcome = 'completed', settled_at = ? WHERE id = ?`,
      [world.state.world.clock.now(), firstOpen?.id ?? ''],
    );

    const accepted = await autoAnswers(answer);

    expect(accepted).toMatchObject({ isOk: true, data: { answered: true } });
    expect((await delegationOf(world, parent.delegationId)).state).toBe('starting');
  });

  it('stops the substeps before the parent', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const parent = firstParent(parents);
    await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(parent)] },
    });
    await autoTurnEnds({ world });
    const [parentRow] = await plainOf(world);
    const [helperRow] = await helpersOf(world);

    const outcome = await stopTree({ ctx: world.state.ctx, treeId: world.treeId });

    expect(outcome).toEqual({ kind: 'stopped' });
    const order = world.state.ports.cancels.map((cancel) => String(cancel.agentId));
    const helperAt = order.indexOf(String(helperRow?.childAgentId));
    expect(helperAt).toBeGreaterThanOrEqual(0);
    const parentAt = order.indexOf(String(parentRow?.childAgentId));
    expect(parentAt === -1 || helperAt < parentAt).toBe(true);
    const rows = await allOf(world);
    expect(rows.every((row) => row.state === 'settled' && row.outcome === 'stopped')).toBe(true);
  });

  it('keeps the parent paused and the scout running across a restart', async () => {
    const { world, parents } = await pausedParents({ count: 1 });
    const parent = firstParent(parents);
    await autoDelegates({
      world,
      requestId: 'request-2',
      spec: { children: [helperFor(parent)] },
    });
    await autoTurnEnds({ world });
    const [helperRow] = await helpersOf(world);
    world.state.ports.liveRuns.add(world.state.ports.childTurns[1]?.runId ?? '');

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect((await delegationOf(restarted, parent.delegationId)).state).toBe('paused');
    expect(['starting', 'running']).toContain(
      (await delegationOf(restarted, helperRow?.id ?? '')).state,
    );
    expect((await delegationOf(restarted, helperRow?.id ?? '')).request['parent']).toEqual({
      ...parent,
      depth: 2,
    });
    expect(restarted.errors).toEqual([]);
  });
});
