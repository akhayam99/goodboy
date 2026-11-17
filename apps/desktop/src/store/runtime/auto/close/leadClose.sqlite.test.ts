import { describe, expect, it } from 'vitest';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { getAutoDelegation, readAutoArtifactLiveState } from '@goodboy/db';
import { brandId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import type { AutoTreeView } from '../../../slices/auto-view/state';
import { autoGroupOf } from '../../../../features/auto/autoGroupOf';
import { delegationClosedOf } from '../../../../features/auto/delegationClosedOf';
import { dockPlanRowOf } from '../../../../features/auto/dockPlanRowOf';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import { planDiscardAskOf } from '../../../../features/auto/planDiscardAskOf';
import { dropAutoPlan } from '../../../../features/auto/plan/dropAutoPlan';
import { writeAutoLevel } from '../level/writeAutoLevel';
import {
  batchInput,
  childInput,
  registerPlan,
  WORLD_NOW,
  WORLD_RUN,
  WORLD_TREE,
} from '../testing/autoWorld';
import {
  autoBlockText,
  autoCommand,
  autoTurnEnds,
  makeRuntimeWorld,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SCOUT = 'delegation-scout';

const leadWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({
    agentIds: ['agent-planner', 'agent-planner-2', 'agent-scout'],
    planIds: [
      { id: 'plan-1', agentId: 'agent-planner' },
      { id: 'plan-2', agentId: 'agent-planner-2' },
    ],
  });
  const db = world.state.world.db;
  await world.state.world.scheduler.transition({
    treeId: WORLD_TREE,
    expect: { phaseRev: 0, generation: 1, from: ['answering'] },
    to: 'deciding',
    patch: { activeRunId: WORLD_RUN, isNewTurn: true },
  });
  const admitted = await world.state.world.scheduler.admit(
    batchInput({
      requestId: 'request-plan',
      children: [
        childInput({ key: 'plan', role: 'planner', agentId: 'agent-planner' }),
        childInput({ key: 'scout', role: 'scout', agentId: 'agent-scout' }),
      ],
    }),
  );
  if (admitted.kind !== 'accepted') {
    throw new Error(JSON.stringify(admitted));
  }
  await registerPlan({
    world: world.state.world,
    id: 'plan-1',
    agentId: 'agent-planner',
    delegationId: 'delegation-plan',
  });
  await db.execute(
    `UPDATE auto_delegations SET state = 'settled', outcome = 'completed', settled_at = ?
      WHERE id = 'delegation-plan'`,
    [WORLD_NOW],
  );
  await db.execute(
    `UPDATE auto_delegations SET state = 'settled', outcome = 'blocked', settled_at = ?
      WHERE id = ?`,
    [WORLD_NOW, SCOUT],
  );
  await db.execute(`UPDATE auto_artifacts SET approval_state = 'needs_approval'`);
  await db.execute(
    `UPDATE auto_trees SET phase = 'done', is_yield_requested = 0, turn_delegate_calls = 0`,
  );
  await world.runtime.say({ treeId: world.treeId, text: 'make a new plan with all we said' });
  await world.runtime.settled();
  return world;
};

type WorldParams = {
  readonly world: RuntimeWorld;
};

const viewOf = async ({ world }: WorldParams): Promise<AutoTreeView> => {
  const views = await readAutoTreeViews({
    db: world.state.world.db,
    sessionId: AUTO_SEED_SESSION,
  });
  const view = views[0];
  if (view === undefined) {
    throw new Error('no Lead view');
  }
  return view;
};

type CloseParams = WorldParams & {
  readonly target: string;
  readonly as: string;
  readonly reason: string;
};

const close = ({ world, target, as, reason }: CloseParams) =>
  autoCommand({ world, verb: 'close', args: { target, as, reason } });

describe('the Lead manages its own agents and plans', () => {
  it('closes an idle Scout, and the rail shows it closed with the reason', async () => {
    const world = await leadWorld();

    const outcome = await close({
      world,
      target: SCOUT,
      as: 'done',
      reason: 'not needed after the new plan',
    });

    expect(outcome.error ?? '').toBe('');
    expect(outcome).toMatchObject({ isOk: true });
    const view = await viewOf({ world });
    const scout = view.delegations.find((delegation) => delegation.id === SCOUT);
    expect(scout === undefined ? null : delegationClosedOf({ delegation: scout })).toEqual({
      as: 'done',
      reason: 'not needed after the new plan',
    });
    expect(
      scout !== undefined &&
        isAutoReturnDecided({ delegation: scout, delegations: view.delegations }),
    ).toBe(true);
    const group = autoGroupOf({ view, agents: [], now: WORLD_NOW });
    expect(group?.children.find((child) => child.delegationId === SCOUT)).toMatchObject({
      state: 'done',
      reason: 'Closed by the Lead: not needed after the new plan',
    });
    expect(world.errors).toEqual([]);
  });

  it('marks a step skipped, and the skipped step counts as done', async () => {
    const world = await leadWorld();

    await close({ world, target: SCOUT, as: 'skipped', reason: 'the plan covers it' });

    const group = autoGroupOf({ view: await viewOf({ world }), agents: [], now: WORLD_NOW });
    expect(group?.children.find((child) => child.delegationId === SCOUT)).toMatchObject({
      state: 'done',
      reason: 'Skipped by the Lead: the plan covers it',
    });
  });

  it('discards an agent: off the rail, transcript kept', async () => {
    const world = await leadWorld();

    await close({ world, target: SCOUT, as: 'discarded', reason: 'wrong question' });

    const view = await viewOf({ world });
    expect(view.delegations.map((delegation) => delegation.id)).not.toContain(SCOUT);
    expect(view.hiddenChildIds).toContain('agent-scout');
    const rows = await world.state.world.db.select<{ readonly deleted_at: number | null }>(
      'SELECT deleted_at FROM agents WHERE id = ?',
      ['agent-scout'],
    );
    expect(rows).toEqual([{ deleted_at: null }]);
  });

  it('is a no-op for the same verb twice and for a child already gone', async () => {
    const world = await leadWorld();
    const params = { world, target: SCOUT, as: 'done', reason: 'done with it' };

    await close(params);
    const again = await close(params);
    expect(again).toMatchObject({ isOk: true, data: { isNoop: true } });

    await world.state.world.db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [
      WORLD_NOW,
      'agent-planner',
    ]);
    const late = await close({
      world,
      target: 'delegation-plan',
      as: 'done',
      reason: 'late',
    });
    expect(late).toMatchObject({ isOk: true, data: { isNoop: true, isGone: true } });
    const planner = await getAutoDelegation({
      db: world.state.world.db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-plan' }),
    });
    expect(planner === null ? null : delegationClosedOf({ delegation: planner })).toBeNull();
  });

  it('asks the user before dropping a plan that waits for their approval', async () => {
    const world = await leadWorld();
    await writeAutoLevel({
      db: world.state.world.db,
      target: { sessionId: AUTO_SEED_SESSION },
      level: 'plan',
    });

    const outcome = await close({
      world,
      target: 'plan-1',
      as: 'discarded',
      reason: 'a new plan replaces it',
    });

    expect(outcome).toMatchObject({ isOk: true, data: { asked: 'plan-1' } });
    const db = world.state.world.db;
    const planId = brandId<ArtifactId>({ value: 'plan-1' });
    expect((await readAutoArtifactLiveState({ db, artifactId: planId }))?.status).toBe('active');
    const view = await viewOf({ world });
    const row = dockPlanRowOf({ view });
    expect(row === null ? null : planDiscardAskOf({ view, row })).toEqual({
      revision: 1,
      reason: 'a new plan replaces it',
    });

    await dropAutoPlan({ db, treeId: world.treeId, artifactId: 'plan-1' });

    expect((await readAutoArtifactLiveState({ db, artifactId: planId }))?.status).toBe('discarded');
    expect(dockPlanRowOf({ view: await viewOf({ world }) })).toBeNull();
  });

  it('drops plan v1 at once when the user lets plans go, and the dock shows the new plan only', async () => {
    const world = await leadWorld();
    const db = world.state.world.db;
    await writeAutoLevel({ db, target: { sessionId: AUTO_SEED_SESSION }, level: 'run' });
    await registerPlan({
      world: world.state.world,
      id: 'plan-2',
      agentId: 'agent-planner-2',
      delegationId: 'delegation-plan',
    });
    await db.execute(
      `UPDATE auto_artifacts SET approval_state = 'needs_approval', created_at = created_at + 1
        WHERE artifact_id = 'plan-2'`,
    );

    const outcome = await close({
      world,
      target: 'plan-1',
      as: 'discarded',
      reason: 'plan-2 replaces it',
    });

    expect(outcome).toMatchObject({ isOk: true, data: { discarded: 'plan-1' } });
    const view = await viewOf({ world });
    expect(dockPlanRowOf({ view })?.artifact.artifactId).toBe('plan-2');
    const again = await close({ world, target: 'plan-1', as: 'discarded', reason: 'again' });
    expect(again).toMatchObject({ isOk: true, data: { isNoop: true } });
  });

  it('reads close blocks written before the last block of a Lead turn', async () => {
    const world = await leadWorld();

    await autoTurnEnds({
      world,
      text: [
        'I tidy up before the new plan.',
        autoBlockText({ action: 'close', target: SCOUT, as: 'done', reason: 'not needed' }),
        autoBlockText({ action: 'close', target: 'nope', as: 'done', reason: 'unknown' }),
        autoBlockText({ action: 'finish', summary: 'Tidied.' }),
      ].join('\n'),
    });

    const view = await viewOf({ world });
    const scout = view.delegations.find((delegation) => delegation.id === SCOUT);
    expect(scout === undefined ? null : delegationClosedOf({ delegation: scout })?.as).toBe('done');
    const refusals = await world.state.world.db.select<{ readonly payload_json: string }>(
      `SELECT payload_json FROM auto_outbox WHERE kind = 'refusal' AND join_key LIKE '%:close'`,
    );
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.payload_json).toContain('nope');
  });
});
