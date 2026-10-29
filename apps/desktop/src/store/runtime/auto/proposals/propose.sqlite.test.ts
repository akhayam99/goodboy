import { describe, expect, it, vi } from 'vitest';
import { getAutoDelegation, getAutoTree, listAutoDelegations, listAutoOutbox } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { applyAutoBlock } from '../applyAutoBlock';
import { confirmDelegation } from '../confirmDelegation';
import { writeAutoLevel } from '../level/writeAutoLevel';
import { endedTurn } from '../testing/deliveryWorld';
import {
  autoBlockText,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  autoTurnEndsWithBlock,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
} from '../testing/runtimeWorld';
import { runAutoCommand } from '../runAutoCommand';
import { WORLD_GRANT } from '../testing/fakePorts';

const proposal = {
  action: 'propose',
  requestId: 'harborline-next',
  primary: { role: 'scout', task: 'Read ledger-core.', reason: 'Find callers.' },
  alternatives: [
    { label: 'Spawn an investigator', role: 'investigator' },
    { label: 'Spawn a planner', role: 'planner' },
  ],
};

const pending = async () => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-harborline', text: 'Read ledger-core.' });
  const turn = world.state.ports.autoTurns.at(-1);
  if (turn === undefined) {
    throw new Error('Expected an Auto turn');
  }
  await autoTurnEndsWithBlock({ world, block: proposal });
  const db = world.state.world.db;
  const rows = await listAutoDelegations({ db, treeId: world.treeId });
  const delegation = rows[0];
  if (delegation === undefined) {
    throw new Error('Expected a pending proposal');
  }
  return { world, db, delegation, turn };
};

describe('Auto proposal admission and confirmation', () => {
  it('admits only the primary, keeps alternatives in its request, and survives recovery', async () => {
    const { world, db, delegation } = await pending();
    expect(delegation).toMatchObject({
      state: 'awaiting_confirm',
      request: { alternatives: proposal.alternatives, confirm: true },
    });
    expect(await listAutoDelegations({ db, treeId: world.treeId })).toHaveLength(1);
    expect(world.state.ports.childTurns).toHaveLength(0);
    expect(await getAutoTree({ db, treeId: world.treeId })).toMatchObject({
      delegationsUsed: 1,
      attemptsUsed: 1,
    });
    const recovered = restartedWorld({ world });
    await recovered.runtime.recover(world.treeId);
    await recovered.runtime.settled();
    expect(recovered.state.ports.childTurns).toHaveLength(0);
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toMatchObject({
      state: 'awaiting_confirm',
      request: { alternatives: proposal.alternatives },
    });
  });

  it('starts the primary without an Auto turn and includes the saved hint in its brief', async () => {
    const { world, db, delegation } = await pending();
    const turns = world.state.ports.autoTurns.length;
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: '  Focus on payments-api.  ',
      }),
    ).toBe('confirmed');
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toMatchObject({
      state: 'accepted',
      request: {
        hint: 'Focus on payments-api.',
        task: expect.stringContaining('Focus on payments-api.'),
        kickoff: expect.stringContaining('Focus on payments-api.'),
      },
    });
    await world.runtime.drive(world.treeId);
    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(world.state.ports.childTurns[0]?.text).toContain('USER HINT\nFocus on payments-api.');
    expect(world.state.ports.autoTurns).toHaveLength(turns);
    expect(world.errors).toEqual([]);
  });

  it('retains the hint when Auto retries the earlier work', async () => {
    const { world, delegation } = await pending();
    await world.runtime.confirm({
      delegationId: delegation.id,
      decision: 'confirm',
      hint: 'Read payments-api too.',
    });
    await world.runtime.drive(world.treeId);
    await childTurnEnds({ world, index: 0, text: 'Could not finish.' });
    expect(
      await autoDelegates({
        world,
        requestId: 'harborline-retry',
        spec: [{ retryOf: delegation.id, reason: 'Finish reading ledger-core.' }],
      }),
    ).toMatchObject({ isOk: true });
    await autoTurnEnds({ world });
    const rows = await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });
    const retry = rows.find((row) => row.retryOf === delegation.id);
    if (retry === undefined) {
      throw new Error('Expected a retry');
    }
    expect(retry.state).toBe('awaiting_confirm');
    await world.runtime.confirm({ delegationId: retry.id, decision: 'confirm' });
    await world.runtime.drive(world.treeId);
    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(world.state.ports.childTurns[1]?.text).toContain('USER HINT\nRead payments-api too.');
    expect(world.errors).toEqual([]);
  });

  it('keeps the proposal and brief unchanged on a failed write, then retries the same id once', async () => {
    const { world, db, delegation } = await pending();
    const transaction = vi.spyOn(db, 'transaction');
    transaction.mockRejectedValueOnce(new Error('Could not save the choice.'));
    await expect(
      world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api too.',
      }),
    ).rejects.toThrow('Could not save the choice.');
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toEqual(delegation);
    expect(world.state.ports.childTurns).toHaveLength(0);
    transaction.mockRestore();
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api too.',
      }),
    ).toBe('confirmed');
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'A late hint.',
      }),
    ).toBe('lost');
    const saved = await getAutoDelegation({ db, delegationId: delegation.id });
    expect(saved?.request['hint']).toBe('Read payments-api too.');
    expect(saved?.request['kickoff']).not.toContain('A late hint.');
  });

  it('rolls back both the hint and accepted state if the transaction aborts after the updates', async () => {
    const { world, db, delegation } = await pending();
    const runTransaction = db.transaction;
    const transaction = vi.spyOn(db, 'transaction');
    transaction.mockImplementationOnce(({ statements }) =>
      runTransaction({
        statements: [
          ...statements,
          { sql: 'SELECT 1 WHERE 0', abortWhen: 'noRows', abortCode: 'confirm_state' },
        ],
      }),
    );
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api.',
      }),
    ).toBe('lost');
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toEqual(delegation);
    transaction.mockRestore();
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api.',
      }),
    ).toBe('confirmed');
  });

  it('lets only one concurrent decision save its hint', async () => {
    const { world, db, delegation } = await pending();
    const outcomes = await Promise.all([
      confirmDelegation({
        ctx: world.runtime.ctx,
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api.',
      }),
      confirmDelegation({
        ctx: world.runtime.ctx,
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read notify-relay.',
      }),
    ]);
    expect([...outcomes].sort()).toEqual(['confirmed', 'lost']);
    const saved = await getAutoDelegation({ db, delegationId: delegation.id });
    const winningHint = outcomes[0] === 'confirmed' ? 'Read payments-api.' : 'Read notify-relay.';
    expect(saved?.request['hint']).toBe(winningHint);
    expect(saved?.request['kickoff']).toBe(
      `${delegation.request['kickoff']}\n\nUSER HINT\n${winningHint}`,
    );
  });

  it.each([
    'generation = generation + 1',
    "stop_state = 'requested'",
    "scheduler_owner = 'window-other'",
  ])('drops the hint when the tree moved on: %s', async (patch) => {
    const { world, db, delegation } = await pending();
    await db.execute(`UPDATE auto_trees SET ${patch} WHERE id = ?`, [world.treeId]);
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api.',
      }),
    ).toBe('lost');
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toEqual(delegation);
  });

  it('loses a concurrent decline after another window confirmed the primary', async () => {
    const { world, db, delegation } = await pending();
    const outcomes = await Promise.all([
      world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api.',
      }),
      world.runtime.confirm({ delegationId: delegation.id, decision: 'decline' }),
    ]);
    expect(outcomes).toEqual(['confirmed', 'lost']);
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toMatchObject({
      state: 'accepted',
      request: { hint: 'Read payments-api.' },
    });
  });

  it('drops a confirm that was already read when the tree generation changes', async () => {
    const { world, db, delegation } = await pending();
    const runTransaction = db.transaction;
    const transaction = vi.spyOn(db, 'transaction');
    transaction.mockImplementationOnce(async ({ statements }) => {
      await db.execute('UPDATE auto_trees SET generation = generation + 1 WHERE id = ?', [
        world.treeId,
      ]);
      return runTransaction({ statements });
    });
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'confirm',
        hint: 'Read payments-api.',
      }),
    ).toBe('lost');
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toEqual(delegation);
    transaction.mockRestore();
  });

  it('ignores hints on decline and cannot confirm that choice again', async () => {
    const { world, db, delegation } = await pending();
    expect(
      await world.runtime.confirm({
        delegationId: delegation.id,
        decision: 'decline',
        hint: 'Read payments-api.',
      }),
    ).toBe('declined');
    expect(await getAutoDelegation({ db, delegationId: delegation.id })).toMatchObject({
      state: 'settled',
      reason: 'declined',
      request: delegation.request,
    });
    expect(await world.runtime.confirm({ delegationId: delegation.id, decision: 'confirm' })).toBe(
      'lost',
    );
  });

  it('treats a blank hint as an ordinary confirmation', async () => {
    const { world, db, delegation } = await pending();
    expect(
      await world.runtime.confirm({ delegationId: delegation.id, decision: 'confirm', hint: '  ' }),
    ).toBe('confirmed');
    expect((await getAutoDelegation({ db, delegationId: delegation.id }))?.request).toEqual(
      delegation.request,
    );
  });

  it('replays a settled proposal and refuses a request id reused with different alternatives', async () => {
    const { world, db, turn } = await pending();
    const replay = await applyAutoBlock({
      ctx: world.runtime.ctx,
      ended: endedTurn({
        runId: turn.runId,
        deliveryId: turn.deliveryId,
        assistantText: autoBlockText(proposal),
      }),
    });
    expect(replay).toEqual({ kind: 'applied', action: 'propose' });
    const conflict = await runAutoCommand({
      ctx: world.runtime.ctx,
      command: {
        verb: 'propose',
        args: {
          'request-id': proposal.requestId,
          spec: JSON.stringify({ ...proposal, alternatives: [] }),
        },
        grant: { ...WORLD_GRANT, runId: turn.runId },
      },
    });
    expect(conflict).toMatchObject({ isOk: false, code: 'request_conflict' });
    expect(await listAutoDelegations({ db, treeId: world.treeId })).toHaveLength(1);
  });

  it('refuses malformed alternatives without admitting the primary', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-harborline', text: 'Read ledger-core.' });
    await autoTurnEndsWithBlock({
      world,
      block: { ...proposal, alternatives: [{ label: 'Spawn a reader', role: 'unknown' }] },
    });
    expect(await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })).toEqual(
      [],
    );
    expect(await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'refusal',
          payload: expect.objectContaining({ code: 'spec_invalid' }),
        }),
      ]),
    );
  });

  it.each(['generation', 'stopped', 'failed'] as const)(
    'drops a late proposal after the run changed: %s',
    async (change) => {
      const world = await makeRuntimeWorld();
      await userSays({ world, id: 'outbox-harborline', text: 'Read ledger-core.' });
      const turn = world.state.ports.autoTurns.at(-1);
      if (turn === undefined) {
        throw new Error('Expected an Auto turn');
      }
      const db = world.state.world.db;
      if (change === 'generation') {
        await db.execute('UPDATE auto_trees SET generation = generation + 1 WHERE id = ?', [
          world.treeId,
        ]);
      }
      if (change === 'stopped') {
        await db.execute("UPDATE auto_trees SET stop_state = 'requested' WHERE id = ?", [
          world.treeId,
        ]);
      }
      const outcome = await applyAutoBlock({
        ctx: world.runtime.ctx,
        ended: endedTurn({
          runId: turn.runId,
          deliveryId: turn.deliveryId,
          assistantText: autoBlockText(proposal),
          exit: change === 'failed' ? 'error' : 'ok',
        }),
      });
      expect(outcome.kind).toBe('skipped');
      expect(await listAutoDelegations({ db, treeId: world.treeId })).toEqual([]);
      expect(world.state.ports.childTurns).toHaveLength(0);
    },
  );

  it('keeps an explicit proposal pending even at Never', async () => {
    const world = await makeRuntimeWorld();
    await writeAutoLevel({
      db: world.state.world.db,
      target: { sessionId: AUTO_SEED_SESSION },
      level: 'run',
    });
    await userSays({ world, id: 'outbox-harborline', text: 'Read ledger-core.' });
    await autoTurnEndsWithBlock({ world, block: proposal });
    expect(
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId }),
    ).toMatchObject([{ state: 'awaiting_confirm' }]);
    expect(world.state.ports.childTurns).toHaveLength(0);
  });
});
