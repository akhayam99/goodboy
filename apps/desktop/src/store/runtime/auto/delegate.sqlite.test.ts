import { describe, expect, it } from 'vitest';
import {
  getAutoDelegation,
  getAutoTree,
  listAutoDelegations,
  listAutoReservations,
} from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { runAutoCommand } from './runAutoCommand';
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
  runAutoCommand({ ctx: setupResult.ctx, command });

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

describe('the delegate command', () => {
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
  });

  it('returns the same receipt for the same request and starts nothing twice', async () => {
    const state = await setup();
    await run(state, delegateCommand(scoutAndImplementer));
    const second = await run(state, delegateCommand(scoutAndImplementer));
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(second.isOk).toBe(true);
    expect(second.data).toMatchObject({ replayed: true, batchId: rows[0]?.batchId });
    expect(rows).toHaveLength(2);
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

  it('admits a writer that names no mount on the only mount of the session', async () => {
    const state = await setup();
    state.ports.setMounts([
      (await state.ports.loadMounts({ sessionId: WORLD_GRANT.sessionId }))[0]!,
    ]);
    const outcome = await run(
      state,
      delegateCommand({
        children: [{ role: 'implementer', task: 'change it', reason: 'a code change' }],
      }),
    );
    expect(outcome.isOk).toBe(true);
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows[0]?.target).toMatchObject({ mountId: 'mount-ledger-core', mountSource: 'only' });
  });

  it('refuses a writer that names no mount among two, lists the choices and writes nothing', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: [{ role: 'implementer', task: 'change it', reason: 'a code change' }],
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'mount_ambiguous' });
    expect(outcome.error).toContain('mount-ledger-core');
    expect(outcome.error).toContain('mount-notify-relay');
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      phase: 'deciding',
      isYieldRequested: false,
      refusalsUsed: 1,
      turnDelegateCalls: 1,
    });
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

  it('refuses a Rewriter before any agent exists, naming what to do instead', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: [
          {
            role: 'rewriter',
            task: 'squash the fixup commits of ledger-core',
            reason: 'tidy the history',
            mount: 'mount-ledger-core',
          },
        ],
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(JSON.stringify(outcome)).toContain('History flow');
    expect(JSON.stringify(outcome)).toContain('implementer with');
    expect(JSON.stringify(outcome)).toContain('force');
    expect(JSON.stringify(outcome)).toContain('backup');
    expect(JSON.stringify(outcome)).not.toContain('Tell the user to rewrite');
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
    expect(state.ports.ensuredChildren).toHaveLength(0);
  });

  it('refuses a Rewriter that also needs a shell with the History refusal first', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: [
          {
            role: 'rewriter',
            task: 'Run git rebase on ledger-core and squash the fixup commits.',
            reason: 'tidy the history',
            mount: 'mount-ledger-core',
          },
        ],
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(JSON.stringify(outcome)).toContain('History flow');
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('admits a Scribe and a CI fixer as writers on the mount they name', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: ['scribe', 'ci-fixer'].map((role) => ({
          role,
          task: `${role} work on ledger-core`,
          reason: 'the role for this work',
          mount: 'mount-ledger-core',
        })),
      }),
    );
    expect(outcome.isOk).toBe(true);
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows.map((row) => row.role)).toEqual(['scribe', 'ci-fixer']);
    for (const row of rows) {
      expect(row.target).toMatchObject({ mountId: 'mount-ledger-core', mountSource: 'named' });
      expect(String(row.request['kickoff'])).toContain('You change files, only in the mount');
    }
    expect(String(rows[0]?.request['kickoff'])).toContain('<<pr-title>>');
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

  it('refuses a reviewer asked to judge each commit of a range, which only git can list', async () => {
    const state = await setup();
    const refused = await run(
      state,
      delegateCommand({
        children: [
          {
            role: 'reviewer',
            task: 'Check each commit in `a1b2c3d4e..HEAD`: does its subject match its diff?',
            reason: 'an audit of the history',
          },
        ],
      }),
    );
    expect(refused).toMatchObject({ isOk: false, code: 'role_lacks_shell' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
  });

  it('refuses a read only role for a task that runs commands, then admits the reroute to a writer', async () => {
    const state = await setup();
    const task = 'Run git log and git ls-remote on ledger-core and compare the heads.';
    const refused = await run(
      state,
      delegateCommand({
        children: [{ role: 'investigator', task, reason: 'a check of the branch' }],
      }),
    );
    expect(refused).toMatchObject({ isOk: false, code: 'role_lacks_shell' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
    const rerouted = await run(
      state,
      delegateCommand(
        {
          children: [
            {
              role: 'implementer',
              task: `${task} Read only: change nothing.`,
              reason: 'the check runs git, which needs a shell',
              mount: 'mount-ledger-core',
            },
          ],
        },
        'request-2',
      ),
    );
    expect(rerouted).toMatchObject({ isOk: true });
    const rows = await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows.map((row) => row.role)).toEqual(['implementer']);
  });

  it('keeps a read only role for a task that only reads', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      delegateCommand({
        children: [
          {
            role: 'investigator',
            task: 'Explain why the ledger total is off by one in the export.',
            reason: 'a diagnosis',
          },
        ],
      }),
    );
    expect(outcome.isOk).toBe(true);
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
      grant: { ...WORLD_GRANT, runId: 'run-later' },
    });
    expect(broken).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      refusalsUsed: 2,
    });
  });

  it('counts the refusals of one run once and those of two runs twice', async () => {
    const state = await setup();
    const refused = { children: [{ role: 'generic', task: 'x', reason: 'y' }] };
    await run(state, delegateCommand(refused));
    await run(state, delegateCommand(refused));
    await run(state, {
      ...delegateCommand(refused),
      grant: { ...WORLD_GRANT, runId: 'run-later' },
    });
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
    const outcome = await runAutoCommand({
      ctx: { ...state.ctx, scheduler: other },
      command: delegateCommand(scoutAndImplementer),
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'not_owner' });
    expect(await listAutoDelegations({ db: state.world.db, treeId: WORLD_TREE })).toHaveLength(0);
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
});
