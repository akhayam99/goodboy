import { describe, expect, it } from 'vitest';
import type { AutoLevel } from '@goodboy/core';
import {
  getAutoDelegation,
  readAutoArtifactLiveState,
  listAutoDelegations,
  setSetting,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AutoDelegationId, type ArtifactId } from '@goodboy/types';
import { confirmDelegation } from '../confirmDelegation';
import { runAutoCommand } from '../runAutoCommand';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  planRef,
  registerPlan,
  startNewTurn,
  WORLD_TREE,
} from '../testing/autoWorld';
import { makeFakePorts, WORLD_GRANT } from '../testing/fakePorts';
import { writeAutoLevel } from './writeAutoLevel';

const target = { sessionId: AUTO_SEED_SESSION };
const levels: ReadonlyArray<AutoLevel> = ['step', 'plan', 'run'];

describe('Auto level admission', () => {
  it.each(levels)(
    'admits readers and writers at %s with the appropriate confirmation',
    async (level) => {
      const world = await makeAutoWorld();
      await writeAutoLevel({ db: world.db, target, level });
      const outcome = await world.scheduler.admit(
        batchInput({
          children: [
            childInput({ key: 'scout' }),
            childInput({ key: 'planner', role: 'planner' }),
            childInput({ key: 'implementer', role: 'implementer' }),
          ],
        }),
      );
      expect(outcome.kind).toBe('accepted');
      const rows = await listAutoDelegations({ db: world.db, treeId: WORLD_TREE });
      const state = level === 'step' ? 'awaiting_confirm' : 'accepted';
      expect(rows.map((row) => row.state)).toEqual([state, state, state]);
      expect(
        outcome.kind === 'accepted' ? outcome.receipt.delegations.map((row) => row.state) : [],
      ).toEqual([state, state, state]);
    },
  );

  it.each(levels)(
    'checks an unapproved plan at %s in diagnosis and the SQL write',
    async (level) => {
      const world = await makeAutoWorld({
        agentIds: ['agent-planner'],
        planIds: [{ id: 'plan-acme', agentId: 'agent-planner' }],
      });
      await registerPlan({ world, id: 'plan-acme', agentId: 'agent-planner' });
      await writeAutoLevel({ db: world.db, target, level });
      const outcome = await world.scheduler.admit(
        batchInput({
          children: [
            childInput({
              key: 'implementer',
              role: 'implementer',
              inputArtifacts: [planRef({ id: 'plan-acme', revision: 1 })],
            }),
          ],
        }),
      );
      expect(outcome.kind === 'refused' ? outcome.code : outcome.kind).toBe(
        level === 'run' ? 'accepted' : 'artifact_unapproved',
      );
      const rows = await listAutoDelegations({ db: world.db, treeId: WORLD_TREE });
      expect(rows).toHaveLength(level === 'run' ? 1 : 0);
      const plan = await readAutoArtifactLiveState({
        db: world.db,
        artifactId: brandId<ArtifactId>({ value: 'plan-acme' }),
      });
      expect(plan?.status).toBe(level === 'run' ? 'consumed' : 'active');
    },
  );

  it('reads a second writer after a refusal and keeps the revision pinned at Never', async () => {
    const world = await makeAutoWorld({
      agentIds: ['agent-planner'],
      planIds: [{ id: 'plan-acme', agentId: 'agent-planner' }],
    });
    await registerPlan({ world, id: 'plan-acme', agentId: 'agent-planner' });
    const children = [
      childInput({
        key: 'implementer',
        role: 'implementer',
        inputArtifacts: [planRef({ id: 'plan-acme', revision: 1 })],
      }),
    ];
    const first = await world.scheduler.admit(batchInput({ children }));
    expect(first).toMatchObject({ kind: 'refused', code: 'artifact_unapproved' });
    await writeAutoLevel({ db: { ...world.db }, target, level: 'run' });
    const stale = await world.scheduler.admit(
      batchInput({
        requestId: 'request-stale',
        children: [
          childInput({
            key: 'implementer',
            role: 'implementer',
            inputArtifacts: [planRef({ id: 'plan-acme', revision: 2 })],
          }),
        ],
      }),
    );
    expect(stale).toMatchObject({ kind: 'refused', code: 'stale_revision' });
    expect(
      (await world.scheduler.admit(batchInput({ requestId: 'request-latest', children }))).kind,
    ).toBe('accepted');
  });

  it('rereads the global off switch at admission without a runtime tick', async () => {
    const world = await makeAutoWorld({
      agentIds: ['agent-planner'],
      planIds: [{ id: 'plan-acme', agentId: 'agent-planner' }],
    });
    await registerPlan({ world, id: 'plan-acme', agentId: 'agent-planner' });
    const children = [
      childInput({
        key: 'implementer',
        role: 'implementer',
        inputArtifacts: [planRef({ id: 'plan-acme', revision: 1 })],
      }),
    ];
    await setSetting(world.db, 'agents.autoPlanApproval', 'false');
    await setSetting(world.db, 'agents.autoPlanApproval', 'true');
    expect(await world.scheduler.admit(batchInput({ children }))).toMatchObject({
      kind: 'refused',
      code: 'artifact_unapproved',
    });
    await setSetting(world.db, 'agents.autoPlanApproval', 'false');
    expect(
      (await world.scheduler.admit(batchInput({ requestId: 'request-off', children }))).kind,
    ).toBe('accepted');
  });

  it('keeps each pending confirmation after Never and confirms only the named child', async () => {
    const world = await makeAutoWorld();
    const ctx = {
      db: world.db,
      scheduler: world.scheduler,
      ports: makeFakePorts(),
      now: world.clock.now,
    };
    await writeAutoLevel({ db: world.db, target, level: 'step' });
    const batch = batchInput({
      children: [childInput({ key: 'acme' }), childInput({ key: 'cascadia' })],
    });
    await world.scheduler.admit(batch);
    await writeAutoLevel({ db: world.db, target, level: 'run' });
    const replay = await world.scheduler.admit(batch);
    expect(replay).toMatchObject({
      kind: 'replayed',
      receipt: { delegations: [{ state: 'awaiting_confirm' }, { state: 'awaiting_confirm' }] },
    });
    await confirmDelegation({
      ctx,
      delegationId: batch.children[0]!.delegationId,
      decision: 'confirm',
    });
    const rows = await listAutoDelegations({ db: world.db, treeId: WORLD_TREE });
    expect(rows.map((row) => row.state)).toEqual(['accepted', 'awaiting_confirm']);
    await startNewTurn({ world, expectedPhaseRev: 3, from: ['delegating'] });
    const next = await world.scheduler.admit(
      batchInput({ requestId: 'request-next', children: [childInput({ key: 'northwind' })] }),
    );
    expect(next).toMatchObject({
      kind: 'accepted',
      receipt: { delegations: [{ state: 'accepted' }] },
    });
  });

  it.each(levels)('keeps an explicit per-child confirm request at %s', async (level) => {
    const world = await makeAutoWorld();
    const ports = makeFakePorts();
    await writeAutoLevel({ db: world.db, target, level });
    const outcome = await runAutoCommand({
      ctx: { db: world.db, scheduler: world.scheduler, ports, now: world.clock.now },
      command: {
        verb: 'delegate',
        grant: WORLD_GRANT,
        args: {
          'request-id': 'request-acme',
          spec: JSON.stringify([
            { role: 'scout', task: 'read ledger-core', reason: 'find callers', confirm: true },
          ]),
        },
      },
    });
    expect(outcome.isOk).toBe(true);
    expect(outcome.data).toMatchObject({ delegations: [{ state: 'awaiting_confirm' }] });
    const row = (await listAutoDelegations({ db: world.db, treeId: WORLD_TREE }))[0];
    expect(row?.request['confirm']).toBe(true);
  });

  it('reads the level saved during child resolution at the admission boundary', async () => {
    const world = await makeAutoWorld();
    const ports = makeFakePorts();
    const resolveRouting = ports.resolveRouting;
    const changedPorts = {
      ...ports,
      resolveRouting: async (params: Parameters<typeof resolveRouting>[0]) => {
        await writeAutoLevel({ db: { ...world.db }, target, level: 'step' });
        return resolveRouting(params);
      },
    };
    await runAutoCommand({
      ctx: { db: world.db, scheduler: world.scheduler, ports: changedPorts, now: world.clock.now },
      command: {
        verb: 'delegate',
        grant: WORLD_GRANT,
        args: {
          'request-id': 'request-acme',
          spec: JSON.stringify([
            { role: 'scout', task: 'read ledger-core', reason: 'find callers' },
          ]),
        },
      },
    });
    const row = (await listAutoDelegations({ db: world.db, treeId: WORLD_TREE }))[0];
    expect(row?.state).toBe('awaiting_confirm');
    const delegationId = brandId<AutoDelegationId>({ value: row?.id ?? '' });
    expect(await getAutoDelegation({ db: world.db, delegationId })).toMatchObject({
      state: 'awaiting_confirm',
    });
  });
});
