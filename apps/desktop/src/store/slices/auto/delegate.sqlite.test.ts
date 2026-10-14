import { describe, expect, it } from 'vitest';
import {
  getAutoDelegation,
  getAutoTree,
  listAutoDelegations,
  listAutoReservations,
} from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { executeAgentCommand } from './executeAgentCommand';
import type { AgentCommand } from './ports';
import { makeAutoWorld, secondScheduler, WORLD_TREE, type AutoWorld } from './testing/autoWorld';
import { makeFakePorts, WORLD_GRANT, type FakePorts } from './testing/fakePorts';
import type { AgentVerbContext } from './verbContext';

type Setup = Readonly<{
  world: AutoWorld;
  ports: FakePorts;
  ctx: AgentVerbContext;
}>;

const setup = async (): Promise<Setup> => {
  const world = await makeAutoWorld();
  const ports = makeFakePorts();
  return {
    world,
    ports,
    ctx: { db: world.db, scheduler: world.scheduler, ports, now: world.clock.now },
  };
};

const delegateCommand = (spec: unknown, requestId = 'request-1'): AgentCommand => ({
  verb: 'delegate',
  args: { 'request-id': requestId, spec: JSON.stringify(spec) },
  grant: WORLD_GRANT,
});

const run = (setupResult: Setup, command: AgentCommand) =>
  executeAgentCommand({ ctx: setupResult.ctx, command, isEnabled: true });

const scoutAndImplementer = {
  children: [
    { role: 'scout', task: 'find the ledger export callers', reason: 'read only search' },
    {
      role: 'implementer',
      task: 'add the export to ledger-core',
      reason: 'a change to the code',
      mount: 'mount-ledger-core',
    },
  ],
};

describe('the delegate verb', () => {
  it('accepts a batch, captures each mount and answers with a receipt', async () => {
    const state = await setup();
    const outcome = await run(state, delegateCommand(scoutAndImplementer));
    expect(outcome.isOk).toBe(true);
    expect(outcome.data).toMatchObject({
      accepted: true,
      replayed: false,
      requestId: 'request-1',
      delegations: [
        {
          role: 'scout',
          state: 'accepted',
          model: 'sonnet',
          mountId: 'mount-ledger-core',
        },
        {
          role: 'implementer',
          state: 'accepted',
          routingReason: expect.stringContaining('mid tier'),
        },
      ],
    });
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows.map((row) => row.role)).toEqual(['scout', 'implementer']);
    expect(rows[1]?.target).toMatchObject({
      mountId: 'mount-ledger-core',
      mountRevision: 3,
      worktreePath: '/work/harborline/ledger-core',
      mountSource: 'named',
    });
    expect(rows[0]?.target).toMatchObject({ mountSource: 'primary' });
    const kickoff = String(rows[1]?.request['kickoff']);
    expect(kickoff).toContain('You were started by Auto and report back to Auto.');
    expect(kickoff).toContain(`<<step-done id="${rows[1]?.childAgentId}">>`);
    expect(kickoff).toContain('add the export to ledger-core');
    const tree = await getAutoTree({ db: state.world.db, treeId: WORLD_TREE });
    expect(tree).toMatchObject({ phase: 'delegating', isYieldRequested: true });
    expect(await listAutoReservations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(2);
    expect(state.ports.yields).toEqual([
      { treeId: WORLD_TREE, generation: 1, runId: 'run-auto-1' },
    ]);
  });

  it('returns the same receipt for the same request and starts nothing twice', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const second = await run(state, delegateCommand(scoutAndImplementer));
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(second.isOk).toBe(true);
    expect(second.data).toMatchObject({ replayed: true, batchId: rows[0]?.batchId });
    expect(rows).toHaveLength(2);
    expect(state.ports.yields).toHaveLength(1);
  });

  it('refuses the same request id with another spec', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const other = await run(
      state,
      delegateCommand({ children: [{ role: 'scout', task: 'something else', reason: 'why' }] }),
    );
    expect(other).toMatchObject({ isOk: false, code: 'request_conflict' });
  });

  it('refuses a writer that names no mount, lists the choices and writes nothing', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: [{ role: 'implementer', task: 'change it', reason: 'a code change' }],
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'mount_missing' });
    expect(outcome.error).toContain('mount-ledger-core');
    expect(outcome.error).toContain('mount-notify-relay');
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      phase: 'deciding',
      isYieldRequested: false,
      refusalsUsed: 1,
      turnDelegateCalls: 1,
    });
    expect(state.ports.yields).toHaveLength(0);
  });

  it('refuses a mount that was deleted before admission and never writes on another one', async () => {
    const state = await setup();
    state.ports.setMounts([
      {
        ...(await state.ports.loadMounts({ sessionId: WORLD_GRANT.sessionId }))[0]!,
        isAttached: false,
      },
    ]);
    const outcome = await run(
      state,
      delegateCommand({
        children: [
          {
            role: 'implementer',
            task: 'change it',
            reason: 'a code change',
            mount: 'mount-ledger-core',
          },
        ],
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'mount_missing' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('starts a reader without a mount on the captured primary mount', async () => {
    const state = await setup();
    await run(
      state,
      delegateCommand({ children: [{ role: 'reviewer', task: 'review it', reason: 'a review' }] }),
    );
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows[0]?.target).toMatchObject({ mountId: 'mount-ledger-core', mountSource: 'primary' });
  });

  it('refuses a role outside the closed list and a spec that is not json', async () => {
    const state = await setup();
    const role = await run(
      state,
      delegateCommand({ children: [{ role: 'generic', task: 'x', reason: 'y' }] }),
    );
    expect(role).toMatchObject({ isOk: false, code: 'role_unknown' });
    const broken = await run(state, {
      verb: 'delegate',
      args: { 'request-id': 'request-2', spec: 'not json' },
      grant: WORLD_GRANT,
    });
    expect(broken).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      refusalsUsed: 2,
    });
  });

  it('refuses a batch whose model cannot be resolved', async () => {
    const state = await setup();
    state.ports.setRouting({ kind: 'blocked', code: 'no_provider', message: 'no model is on' });
    const outcome = await run(state, delegateCommand(scoutAndImplementer));
    expect(outcome).toMatchObject({ isOk: false, code: 'no_provider' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('refuses a second batch in the same turn because the turn already yielded', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const again = await run(
      state,
      delegateCommand({ children: [{ role: 'scout', task: 'more', reason: 'why' }] }, 'request-2'),
    );
    expect(again).toMatchObject({ isOk: false, code: 'already_yielded' });
  });

  it('refuses more than four children and writes none', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: Array.from({ length: 5 }, (_, index) => ({
          role: 'scout',
          task: `look at area ${index}`,
          reason: 'read only search',
        })),
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'breadth_cap' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('leaves a window that does not own the tree out', async () => {
    const state = await setup();
    const other = secondScheduler({ world: state.world });
    const outcome = await executeAgentCommand({
      ctx: { ...state.ctx, scheduler: other },
      command: delegateCommand(scoutAndImplementer),
      isEnabled: true,
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'not_owner' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('answers unavailable while delegation is switched off', async () => {
    const state = await setup();
    const outcome = await executeAgentCommand({
      ctx: state.ctx,
      command: delegateCommand(scoutAndImplementer),
      isEnabled: false,
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'delegation_unavailable' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('reads a receipt back by request id, and says when there is none', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const found = await run(state, {
      verb: 'request-status',
      args: { 'request-id': 'request-1' },
      grant: WORLD_GRANT,
    });
    expect(found.data).toMatchObject({ status: 'accepted', delegations: [{}, {}] });
    const missing = await run(state, {
      verb: 'request-status',
      args: { 'request-id': 'request-9' },
      grant: WORLD_GRANT,
    });
    expect(missing.data).toMatchObject({ status: 'not_found' });
  });

  it('reports the state of the conversation and of one agent', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const overview = await run(state, { verb: 'status', args: {}, grant: WORLD_GRANT });
    expect(overview.data).toMatchObject({
      phase: 'delegating',
      budget: expect.stringContaining('Budget'),
      delegations: [{ role: 'scout' }, { role: 'implementer' }],
    });
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    const one = await run(state, {
      verb: 'status',
      args: { delegation: rows[0]?.id },
      grant: WORLD_GRANT,
    });
    expect(one.data).toMatchObject({ role: 'scout', state: 'accepted' });
    const unknown = await run(state, {
      verb: 'status',
      args: { delegation: 'delegation-nope' },
      grant: WORLD_GRANT,
    });
    expect(unknown).toMatchObject({ isOk: false, code: 'delegation_unknown' });
  });

  it('refuses to finish while agents are still open', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const outcome = await run(state, { verb: 'finish', args: {}, grant: WORLD_GRANT });
    expect(outcome).toMatchObject({ isOk: false, code: 'tree_busy' });
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows).toHaveLength(2);
    expect(
      await getAutoDelegation({
        db: state.world.db,
        delegationId: brandId<AutoDelegationId>({ value: rows[0]?.id ?? '' }),
      }),
    ).not.toBeNull();
  });

  it('lets a conversation with no open agents finish', async () => {
    const state = await setup();
    const outcome = await run(state, { verb: 'finish', args: {}, grant: WORLD_GRANT });
    expect(outcome).toMatchObject({ isOk: true, data: { finished: true } });
  });

  it('refuses an artifact that is not in this conversation', async () => {
    const state = await setup();
    const outcome = await run(state, {
      verb: 'status',
      args: { artifact: 'artifact-elsewhere' },
      grant: WORLD_GRANT,
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'artifact_unknown' });
  });
});
