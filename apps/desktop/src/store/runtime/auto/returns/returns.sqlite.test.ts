import { describe, expect, it, vi } from 'vitest';
import { AUTO_BLOCK_TEXT, AUTO_TREE_LIMITS } from '@goodboy/core/auto';
import {
  getAutoTree,
  insertAutoOutbox,
  listAutoDelegations,
  listAutoOutbox,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import { isAutoDelegationReplaced } from '../../../../features/auto/isAutoDelegationReplaced';
import { applyAutoBlock } from '../applyAutoBlock';
import { deliverNext } from '../deliver';
import { joinReady } from '../join';
import { submitUserMessage } from '../submitUserMessage';
import { secondScheduler } from '../testing/autoWorld';
import { endedTurn } from '../testing/deliveryWorld';
import {
  autoBlockText,
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  autoTurnEndsWithBlock,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';
import { waitingReturnsOf } from './waitingReturnsOf';

const LEDGER = {
  role: 'implementer',
  task: 'add the ledger export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

const NOTIFY = {
  role: 'implementer',
  task: 'add the notify hook',
  reason: 'a code change',
  mount: 'mount-notify-relay',
};

type ChildTextParams = {
  readonly childAgentId: string;
};

const returnText = ({ childAgentId }: ChildTextParams) =>
  `Added the export without archived rows.\n<<step-done id="${childAgentId}" status="returned" needs="decision">>\nShould archived rows be exported?`;

const DONE_TEXT = ({ childAgentId }: ChildTextParams) =>
  `Added the notify hook.\n<<step-done id="${childAgentId}">>`;

type WorldParams = {
  readonly world: RuntimeWorld;
};

const delegationsOf = ({ world }: WorldParams) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const treeOf = async ({ world }: WorldParams) => {
  const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
  if (tree === null) {
    throw new Error('a tree was expected');
  }
  return tree;
};

const lastChildIndex = ({ world }: WorldParams) => world.state.ports.childTurns.length - 1;

type ChildReturnsParams = WorldParams & {
  readonly index?: number;
};

const childReturns = async ({ world, index = lastChildIndex({ world }) }: ChildReturnsParams) => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`no child turn ${index}`);
  }
  await childTurnEnds({ world, index, text: returnText({ childAgentId: turn.childAgentId }) });
  return turn.delegationId;
};

type StartParams = {
  readonly children: ReadonlyArray<unknown>;
};

const startWith = async ({ children }: StartParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
  await autoDelegates({ world, spec: { children } });
  await autoTurnEnds({ world });
  return world;
};

type DelegationByIdParams = WorldParams & {
  readonly id: string;
};

const delegationById = async ({ world, id }: DelegationByIdParams): Promise<AutoDelegation> => {
  const delegation = (await delegationsOf({ world })).find((row) => row.id === id);
  if (delegation === undefined) {
    throw new Error(`no delegation ${id}`);
  }
  return delegation;
};

const lastAutoText = ({ world }: WorldParams) => world.state.ports.autoTurns.at(-1)?.text ?? '';

const fillReturnWindow = async ({ world }: WorldParams) => {
  const nowMs = world.state.world.clock.now();
  for (let index = 0; index < AUTO_TREE_LIMITS.returnsPerTreeWindow; index += 1) {
    await insertAutoOutbox({
      db: world.state.world.db,
      outbox: {
        id: brandId<AutoOutboxId>({ value: `earlier-return-${index}` }),
        treeId: world.treeId,
        generation: 1,
        kind: 'results',
        joinKey: `return:1:earlier-${index}`,
        payload: { kind: 'results', batchId: 'old', results: [], returnOf: `earlier-${index}` },
        nowMs: nowMs - 60_000,
      },
    });
  }
  await world.state.world.db.execute(
    `UPDATE auto_outbox SET state = 'accepted' WHERE id LIKE 'earlier-return-%'`,
  );
};

describe('a returned child reaches Auto at once', () => {
  it('wakes Auto while a sibling still runs, with the return under WAITING FOR YOUR DECISION', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    expect(world.state.ports.childTurns).toHaveLength(2);

    const returned = await childReturns({ world, index: 0 });

    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(lastAutoText({ world })).toContain('WAITING FOR YOUR DECISION');
    expect(lastAutoText({ world })).toContain(`delegation ${returned}, came back once`);
    expect(lastAutoText({ world })).toContain('it asks: Should archived rows be exported?');
    const sibling = world.state.ports.childTurns[1];
    expect((await delegationById({ world, id: sibling?.delegationId ?? '' })).state).toBe(
      'running',
    );
    expect(world.errors).toEqual([]);
  });

  it('leaves the returned child out of the batch result once the sibling ends', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });
    await autoTurnEndsWithBlock({
      world,
      block: { action: 'release', delegation: returned, reason: 'the export can wait' },
    });
    const sibling = world.state.ports.childTurns[1];
    await childTurnEnds({
      world,
      index: 1,
      text: DONE_TEXT({ childAgentId: sibling?.childAgentId ?? '' }),
    });

    const text = lastAutoText({ world });
    expect(text).toContain('RESULTS FROM YOUR AGENTS');
    expect(text).not.toContain(`${returned})`);
    expect(text).not.toContain('WAITING FOR YOUR DECISION');
  });

  it('drops a return that ends after the generation moved on', async () => {
    const world = await startWith({ children: [LEDGER] });
    await world.state.world.db.execute(
      'UPDATE auto_trees SET generation = generation + 1 WHERE id = ?',
      [world.treeId],
    );

    await childReturns({ world, index: 0 });

    const rows = await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId });
    expect(rows.filter((row) => row.joinKey.startsWith('return:'))).toEqual([]);
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });

  it('lets only the owning window join and deliver the return', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    await world.state.world.db.execute(
      `UPDATE auto_attempts SET state = 'ended', outcome = 'blocked', end_reason = 'needs_decision'
        WHERE delegation_id = ?`,
      [world.state.ports.childTurns[0]?.delegationId ?? ''],
    );
    const other = { ...world.state.ctx, scheduler: secondScheduler({ world: world.state.world }) };

    expect(await joinReady({ ctx: other, treeId: world.treeId })).toEqual({ kind: 'idle' });
    expect(
      await deliverNext({ ctx: other, treeId: world.treeId, onEnded: () => undefined }),
    ).toEqual({ kind: 'idle', reason: 'not_owner' });
  });
});

describe('Auto must decide about every return', () => {
  it('repeats an unanswered return next turn and counts it as a turn without progress', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });

    await autoTurnEnds({ world, text: 'I will look at this later.' });

    expect((await treeOf({ world })).noProgressStreak).toBe(1);
    expect(world.state.ports.autoTurns).toHaveLength(3);
    expect(lastAutoText({ world })).toContain(`delegation ${returned}, came back once`);
    expect(lastAutoText({ world })).not.toContain('RESULTS FROM YOUR AGENTS');

    await autoTurnEnds({ world, text: 'Still thinking.' });
    await autoTurnEnds({ world, text: 'Still thinking.' });

    const tree = await treeOf({ world });
    expect(tree.phase).toBe('blocked');
    expect(tree.blockedReason).toBe(AUTO_BLOCK_TEXT.limit_no_progress);
  });

  it('release marks the return done with the reason and stops the repeat', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });

    await autoTurnEndsWithBlock({
      world,
      block: { action: 'release', delegation: returned, reason: 'the notify hook covers it' },
    });

    const delegation = await delegationById({ world, id: returned });
    expect(delegation.request['released']).toMatchObject({ reason: 'the notify hook covers it' });
    expect(
      isAutoDelegationReplaced({ delegation, delegations: await delegationsOf({ world }) }),
    ).toBe(true);
    expect((await treeOf({ world })).noProgressStreak).toBe(0);
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(
      await waitingReturnsOf({ db: world.state.world.db, tree: await treeOf({ world }) }),
    ).toEqual([]);
  });

  it('keeps a return saved while the tree is paused across stop and resume', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    await fillReturnWindow({ world });
    const returned = await childReturns({ world, index: 0 });
    expect((await treeOf({ world })).phase).toBe('blocked');

    expect(await world.runtime.stop(world.treeId)).toMatchObject({ kind: 'stopped' });
    await world.runtime.settled();
    expect(world.state.ports.autoTurns).toHaveLength(1);

    await submitUserMessage({
      ctx: world.runtime.ctx,
      treeId: world.treeId,
      text: 'go on with the export',
    });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(lastAutoText({ world })).toContain('WAITING FOR YOUR DECISION');
    expect(lastAutoText({ world })).toContain(`delegation ${returned}, came back once`);

    await autoTurnEndsWithBlock({
      world,
      block: { action: 'release', delegation: returned, reason: 'the export can wait' },
    });

    expect((await delegationById({ world, id: returned })).request['released']).toMatchObject({
      reason: 'the export can wait',
    });
    expect(
      await waitingReturnsOf({ db: world.state.world.db, tree: await treeOf({ world }) }),
    ).toEqual([]);
  });

  it('carries a return joined while Stop is saving and shows it after resume', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = world.state.ports.childTurns[0]?.delegationId ?? '';
    const { db } = world.state.world;
    await db.execute(
      `UPDATE auto_attempts SET state = 'ended', outcome = 'blocked', end_reason = 'needs_decision'
        WHERE delegation_id = ?`,
      [returned],
    );
    const runTransaction = db.transaction;
    const transaction = vi.spyOn(db, 'transaction');
    let hasJoined = false;
    transaction.mockImplementation(async ({ statements }) => {
      const isStopRequest = statements.some(
        (statement) => 'abortCode' in statement && statement.abortCode === 'stop_request',
      );
      if (isStopRequest && !hasJoined) {
        hasJoined = true;
        expect(await joinReady({ ctx: world.runtime.ctx, treeId: world.treeId })).toMatchObject({
          kind: 'joined',
        });
      }
      return runTransaction({ statements });
    });

    expect(await world.runtime.stop(world.treeId)).toMatchObject({ kind: 'stopped' });
    transaction.mockRestore();
    await world.runtime.settled();
    expect(hasJoined).toBe(true);

    await submitUserMessage({
      ctx: world.runtime.ctx,
      treeId: world.treeId,
      text: 'go on with the export',
    });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(lastAutoText({ world })).toContain('WAITING FOR YOUR DECISION');
    expect(lastAutoText({ world })).toContain(`delegation ${returned}, came back once`);
  });

  it('treats a replayed release of the same turn as applied, with no refusal and no new wake', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });
    const turn = world.state.ports.autoTurns.at(-1);
    const block = { action: 'release', delegation: returned, reason: 'the notify hook covers it' };
    const committed = await applyAutoBlock({
      ctx: world.runtime.ctx,
      ended: endedTurn({
        runId: turn?.runId ?? '',
        deliveryId: turn?.deliveryId ?? '',
        generation: turn?.generation ?? 0,
        assistantText: autoBlockText(block),
      }),
    });
    expect(committed).toMatchObject({ kind: 'applied', action: 'release' });

    await autoTurnEndsWithBlock({ world, block });

    expect((await treeOf({ world })).noProgressStreak).toBe(0);
    expect(world.state.ports.autoTurns).toHaveLength(2);
  });

  it('refuses a second release of the same return', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });
    const first = await autoCommand({
      world,
      verb: 'release',
      args: { delegation: returned, reason: 'not needed' },
    });
    const second = await autoCommand({
      world,
      verb: 'release',
      args: { delegation: returned, reason: 'again' },
    });

    expect(first).toMatchObject({ isOk: true });
    expect(second).toMatchObject({ isOk: false, code: 'not_returned' });
  });

  it('continue with retryOf decides the return and starts the same agent again', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });

    await autoTurnEndsWithBlock({
      world,
      block: {
        action: 'delegate',
        children: [{ retryOf: returned, reason: 'export archived rows too' }],
      },
    });

    const delegations = await delegationsOf({ world });
    expect(delegations.some((row) => row.retryOf === returned)).toBe(true);
    expect((await treeOf({ world })).noProgressStreak).toBe(0);
    expect(world.state.ports.childTurns).toHaveLength(3);
  });

  it('replaces marks the old delegation decided and stores the link', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });

    await autoTurnEndsWithBlock({
      world,
      block: {
        action: 'delegate',
        children: [{ ...LEDGER, role: 'planner', replaces: returned, reason: 'a choice first' }],
      },
    });

    const replacing = (await delegationsOf({ world })).find(
      (row) => row.request['replaces'] === returned,
    );
    expect(replacing?.role).toBe('planner');
    const old = await delegationById({ world, id: returned });
    expect(
      isAutoDelegationReplaced({ delegation: old, delegations: await delegationsOf({ world }) }),
    ).toBe(true);
    expect(
      await waitingReturnsOf({ db: world.state.world.db, tree: await treeOf({ world }) }),
    ).toEqual([]);
  });

  it('brings back a return saved before the upgrade inside a batch result', async () => {
    const world = await startWith({ children: [LEDGER] });
    const returned = await childReturns({ world, index: 0 });
    const { db } = world.state.world;
    const delegation = await delegationById({ world, id: returned });
    const tree = await treeOf({ world });
    await db.execute(`DELETE FROM auto_outbox WHERE tree_id = ? AND kind = 'results'`, [
      world.treeId,
    ]);
    await insertAutoOutbox({
      db,
      outbox: {
        id: brandId<AutoOutboxId>({ value: 'legacy-batch' }),
        treeId: world.treeId,
        generation: tree.generation,
        kind: 'results',
        joinKey: `join:${tree.generation}:${delegation.batchId}`,
        payload: { kind: 'results', batchId: delegation.batchId, results: [delegation.result] },
        nowMs: world.state.world.clock.now(),
      },
    });
    await db.execute(
      `UPDATE auto_outbox SET state = 'accepted', accepted_run_id = 'run-before-upgrade'
        WHERE id = 'legacy-batch'`,
    );

    const waiting = await waitingReturnsOf({ db, tree });
    expect(waiting.map((entry) => entry.result.delegationId)).toEqual([returned]);

    await autoTurnEnds({ world, text: 'Reading the results.' });

    expect(world.state.ports.autoTurns).toHaveLength(3);
    expect(lastAutoText({ world })).toContain('WAITING FOR YOUR DECISION');
    expect(lastAutoText({ world })).toContain(`delegation ${returned}, came back once`);
    const rows = await listAutoOutbox({ db, treeId: world.treeId, kinds: ['results'] });
    expect(
      rows.filter((row) => row.joinKey === `return:${tree.generation}:${returned}`),
    ).toHaveLength(1);
  });
});

describe('the caps on returns', () => {
  it('closes a delegation on its third return: continue is refused with return_limit', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    let returned = await childReturns({ world, index: 0 });
    for (let round = 0; round < AUTO_TREE_LIMITS.returnsPerDelegation; round += 1) {
      await autoTurnEndsWithBlock({
        world,
        block: {
          action: 'delegate',
          requestId: `continue-${round}`,
          children: [{ retryOf: returned, reason: 'go on' }],
        },
      });
      returned = await childReturns({ world });
    }

    expect(lastAutoText({ world })).toContain('came back 3 times');
    expect(lastAutoText({ world })).toContain('so it cannot be continued');
    const refused = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'continue-again',
        spec: JSON.stringify({ children: [{ retryOf: returned, reason: 'once more' }] }),
      },
    });
    expect(refused).toMatchObject({ isOk: false, code: 'return_limit' });
  });

  it('refuses the fourth re-brief along the replaces chain with task_rebrief_limit', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    let returned = await childReturns({ world, index: 0 });
    for (let round = 0; round < AUTO_TREE_LIMITS.rebriefsPerTask; round += 1) {
      await autoTurnEndsWithBlock({
        world,
        block: {
          action: 'delegate',
          requestId: `replace-${round}`,
          children: [{ ...LEDGER, replaces: returned, reason: `brief ${round}` }],
        },
      });
      returned = await childReturns({ world });
    }

    expect(lastAutoText({ world })).toContain('handed to a new agent 3 times already');
    const refused = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'replace-again',
        spec: JSON.stringify({ children: [{ ...LEDGER, replaces: returned, reason: 'again' }] }),
      },
    });
    expect(refused).toMatchObject({ isOk: false, code: 'task_rebrief_limit' });
  });

  it('refuses two children of one block that name the same return', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const returned = await childReturns({ world, index: 0 });
    const before = (await delegationsOf({ world })).length;

    const twoReplaces = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'replace-batch-twice',
        spec: JSON.stringify({
          children: [
            { ...LEDGER, replaces: returned, reason: 'first' },
            { ...LEDGER, replaces: returned, reason: 'second' },
          ],
        }),
      },
    });
    const replaceAndContinue = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'replace-and-continue',
        spec: JSON.stringify({
          children: [
            { ...LEDGER, replaces: returned, reason: 'first' },
            { retryOf: returned, reason: 'second' },
          ],
        }),
      },
    });

    expect(twoReplaces).toMatchObject({ isOk: false, code: 'retry_unavailable' });
    expect(replaceAndContinue).toMatchObject({ isOk: false, code: 'retry_unavailable' });
    expect(await delegationsOf({ world })).toHaveLength(before);
  });

  it('refuses a retryOf that names a return already continued, and continues the latest one', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const original = await childReturns({ world, index: 0 });
    await autoTurnEndsWithBlock({
      world,
      block: {
        action: 'delegate',
        requestId: 'continue-original',
        children: [{ retryOf: original, reason: 'go on' }],
      },
    });
    const latest = await childReturns({ world });

    const again = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'continue-original-again',
        spec: JSON.stringify({ children: [{ retryOf: original, reason: 'once more' }] }),
      },
    });
    const onLatest = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'continue-latest',
        spec: JSON.stringify({ children: [{ retryOf: latest, reason: 'once more' }] }),
      },
    });

    expect(again).toMatchObject({ isOk: false, code: 'retry_unavailable' });
    expect(onLatest).toMatchObject({ isOk: true });
    expect((await delegationsOf({ world })).filter((row) => row.retryOf === original)).toHaveLength(
      1,
    );
  });

  it('refuses a replace that names a return already replaced', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    const original = await childReturns({ world, index: 0 });
    await autoTurnEndsWithBlock({
      world,
      block: {
        action: 'delegate',
        requestId: 'replace-original',
        children: [{ ...LEDGER, replaces: original, reason: 'brief 0' }],
      },
    });
    const turn = world.state.ports.childTurns.at(-1);
    await childTurnEnds({
      world,
      index: lastChildIndex({ world }),
      text: DONE_TEXT({ childAgentId: turn?.childAgentId ?? '' }),
    });

    const refused = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'replace-original-again',
        spec: JSON.stringify({ children: [{ ...LEDGER, replaces: original, reason: 'again' }] }),
      },
    });

    expect(refused).toMatchObject({ isOk: false, code: 'retry_unavailable' });
    expect(
      (await delegationsOf({ world })).filter((row) => row.request['replaces'] === original),
    ).toHaveLength(1);
  });

  it('lets a propose block that names a capped return ask the user, and decides the return', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    let returned = await childReturns({ world, index: 0 });
    for (let round = 0; round < AUTO_TREE_LIMITS.rebriefsPerTask; round += 1) {
      await autoTurnEndsWithBlock({
        world,
        block: {
          action: 'delegate',
          requestId: `replace-capped-${round}`,
          children: [{ ...LEDGER, replaces: returned, reason: `brief ${round}` }],
        },
      });
      returned = await childReturns({ world });
    }

    const proposed = await autoCommand({
      world,
      verb: 'propose',
      args: {
        'request-id': 'ask-the-user',
        spec: JSON.stringify({
          primary: { ...LEDGER, replaces: returned, reason: 'the user picks the way' },
        }),
      },
    });

    expect(proposed).toMatchObject({ isOk: true });
    const proposal = (await delegationsOf({ world })).find(
      (row) => row.request['replaces'] === returned,
    );
    expect(proposal?.state).toBe('awaiting_confirm');
    expect(
      await waitingReturnsOf({ db: world.state.world.db, tree: await treeOf({ world }) }),
    ).toEqual([]);
  });

  it('pauses the tree on the seventh return in 30 minutes and Retry delivers it', async () => {
    const world = await startWith({ children: [LEDGER, NOTIFY] });
    await fillReturnWindow({ world });

    await childReturns({ world, index: 0 });

    const tree = await treeOf({ world });
    expect(tree.phase).toBe('blocked');
    expect(tree.blockedReason).toBe(AUTO_BLOCK_TEXT.limit_returns);
    expect(world.state.ports.autoTurns).toHaveLength(1);

    expect(await world.runtime.retry(world.treeId)).toMatchObject({ kind: 'retried' });
    await world.runtime.settled();

    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(lastAutoText({ world })).toContain('WAITING FOR YOUR DECISION');
  });
});
