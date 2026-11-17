import { describe, expect, it } from 'vitest';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import type { AutoTreeView } from '../../../slices/auto-view/state';
import { planApprovalInViewOf } from '../../../../features/auto/chat/planApprovalInViewOf';
import { dockPlanOf } from '../../../../features/auto/dockPlanOf';
import {
  batchInput,
  childInput,
  registerPlan,
  WORLD_NOW,
  WORLD_RUN,
  WORLD_TREE,
} from '../testing/autoWorld';
import { makeRuntimeWorld, type RuntimeWorld } from '../testing/runtimeWorld';
import { keepAutoPlanBase } from './keepAutoPlanBase';

const REPLAN = 'delegation-replan';
const PLAN_ONE = brandId<ArtifactId>({ value: 'plan-1' });

const planWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({
    agentIds: ['agent-planner', 'agent-planner-2'],
    planIds: [
      { id: 'plan-1', agentId: 'agent-planner' },
      { id: 'plan-2', agentId: 'agent-planner-2' },
    ],
  });
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
        childInput({ key: 'replan', role: 'planner', agentId: 'agent-planner-2' }),
      ],
    }),
  );
  if (admitted.kind !== 'accepted') {
    throw new Error(JSON.stringify(admitted));
  }
  await registerPlan({ world: world.state.world, id: 'plan-1', agentId: 'agent-planner' });
  const db = world.state.world.db;
  await db.execute(
    `UPDATE auto_delegations SET state = 'settled', outcome = 'completed', settled_at = ?
      WHERE id = 'delegation-plan'`,
    [WORLD_NOW],
  );
  await db.execute(`UPDATE session_artifacts SET updated_at = ? WHERE id = 'plan-1'`, [WORLD_NOW]);
  await db.execute(`UPDATE auto_delegations SET state = 'running', created_at = ? WHERE id = ?`, [
    WORLD_NOW + 60_000,
    REPLAN,
  ]);
  await db.execute(`UPDATE auto_artifacts SET approval_state = 'needs_approval'`);
  return world;
};

type WorldParams = {
  readonly world: RuntimeWorld;
};

const viewOf = async ({ world }: WorldParams): Promise<AutoTreeView> => {
  const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });
  const view = views[0];
  if (view === undefined) {
    throw new Error('no Lead view');
  }
  return view;
};

type OutcomeParams = WorldParams & {
  readonly outcome: 'failed' | 'completed';
};

const settleReplan = ({ world, outcome }: OutcomeParams) =>
  world.state.world.db.execute(
    `UPDATE auto_delegations SET state = 'settled', outcome = ?, reason = ?, settled_at = ?
      WHERE id = ?`,
    [outcome, outcome === 'failed' ? 'lost_structure' : null, WORLD_NOW + 120_000, REPLAN],
  );

type KeepParams = WorldParams & {
  readonly revision: number;
};

const keep = ({ world, revision }: KeepParams) =>
  keepAutoPlanBase({
    db: world.state.world.db,
    treeId: WORLD_TREE,
    delegationId: brandId<AutoDelegationId>({ value: REPLAN }),
    artifactId: PLAN_ONE,
    revision,
    nowMs: WORLD_NOW + 180_000,
  });

describe('the plan dock on the stored rows', () => {
  it('updates plan v1 while a new Planner runs, then asks for v2 and marks v1 superseded', async () => {
    const world = await planWorld();

    expect(dockPlanOf({ view: await viewOf({ world }) })).toMatchObject({
      kind: 'updating',
      by: 'planner',
      version: 1,
    });

    await registerPlan({
      world: world.state.world,
      id: 'plan-2',
      agentId: 'agent-planner-2',
      delegationId: REPLAN,
    });
    await world.state.world.db.execute(
      `UPDATE auto_artifacts SET approval_state = 'needs_approval', created_at = ?
        WHERE artifact_id = 'plan-2'`,
      [WORLD_NOW + 120_000],
    );
    await settleReplan({ world, outcome: 'completed' });

    const first = await viewOf({ world });
    const second = await viewOf({ world });
    for (const view of [first, second]) {
      const plan = dockPlanOf({ view });
      expect(plan).toMatchObject({ kind: 'waiting', version: 2 });
      expect(plan?.row.artifact.artifactId).toBe('plan-2');
      const old = view.artifacts.find((row) => row.artifact.artifactId === 'plan-1');
      expect(old === undefined ? null : planApprovalInViewOf({ view, row: old })?.state).toBe(
        'superseded',
      );
    }
  });

  it('says plan v2 failed, and asks for v1 again in every window only after Keep', async () => {
    const world = await planWorld();
    await settleReplan({ world, outcome: 'failed' });

    expect(dockPlanOf({ view: await viewOf({ world }) })).toMatchObject({
      kind: 'failed',
      version: 1,
      reason: 'Its new version lost the structure of the plan.',
    });

    expect(await keep({ world, revision: 1 })).toBe('kept');

    const other = await viewOf({ world });
    expect(dockPlanOf({ view: other })).toMatchObject({ kind: 'waiting', version: 1 });
  });

  it('refuses a Keep for a version that no longer waits, and leaves the failure', async () => {
    const world = await planWorld();
    await settleReplan({ world, outcome: 'failed' });

    expect(await keep({ world, revision: 2 })).toBe('refused');

    expect(dockPlanOf({ view: await viewOf({ world }) })?.kind).toBe('failed');
  });

  it('refuses a Keep while the new Planner still runs', async () => {
    const world = await planWorld();

    expect(await keep({ world, revision: 1 })).toBe('refused');
    expect(dockPlanOf({ view: await viewOf({ world }) })?.kind).toBe('updating');
  });
});
