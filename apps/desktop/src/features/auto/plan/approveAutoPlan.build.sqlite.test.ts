import { describe, expect, it, vi } from 'vitest';
import { getAutoArtifact, listAutoDelegations, listAutoOutbox } from '@goodboy/db';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type ArtifactId } from '@goodboy/types';
import { registerPlan } from '../../../store/runtime/auto/testing/autoWorld';
import {
  autoDelegates,
  makeRuntimeWorld,
  type RuntimeWorld,
} from '../../../store/runtime/auto/testing/runtimeWorld';
import { autoCardHeadOf } from '../chat/autoCardHeadOf';
import { approveAutoPlan } from './approveAutoPlan';

const PLAN = brandId<ArtifactId>({ value: 'plan-1' });
const ASK_THE_USER = 'more than one artifact could be meant';

const IMPLEMENT = {
  children: [
    {
      role: 'implementer',
      task: 'apply the plan to ledger-core',
      reason: 'the approved plan',
      mount: 'mount-ledger-core',
      artifacts: ['plan-1'],
    },
  ],
};

const worldWithTwoArtifacts = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({
    agentIds: ['agent-planner', 'agent-other'],
    planIds: [
      { id: 'plan-1', agentId: 'agent-planner' },
      { id: 'plan-q', agentId: 'agent-other' },
    ],
  });
  await registerPlan({ world: world.state.world, id: 'plan-1', agentId: 'agent-planner' });
  await registerPlan({
    world: world.state.world,
    id: 'plan-q',
    agentId: 'agent-other',
    delegationId: 'delegation-plan-q',
  });
  return world;
};

type ApproveParams = {
  readonly world: RuntimeWorld;
  readonly told: Array<string>;
};

const approve = ({ world, told }: ApproveParams) =>
  approveAutoPlan({
    db: world.state.world.db,
    sessionId: AUTO_SEED_SESSION,
    rootAgentId: AUTO_SEED_ROOT,
    artifactId: PLAN,
    expectedRevision: 1,
    send: async ({ content, focusArtifactId }) => {
      told.push(content);
      await world.runtime.say({ treeId: world.treeId, text: content, facts: { focusArtifactId } });
      await world.runtime.settled();
    },
    onWritten: async () => undefined,
  });

const userRowsOf = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).filter(
    (row) => row.kind === 'user',
  );

describe('approving an Auto plan starts Build', () => {
  it('tells Auto which plan was approved, so it does not ask the user again', async () => {
    const world = await worldWithTwoArtifacts();
    const told: Array<string> = [];

    const result = await approve({ world, told });

    expect(result).toEqual({ kind: 'approved', revision: 1 });
    const turn = world.state.ports.autoTurns.at(-1)?.text ?? '';
    expect(turn).toContain('Approved plan v1.');
    expect(turn).toContain('the user had artifact plan-1 open');
    expect(turn).not.toContain(ASK_THE_USER);
  });

  it('would make Auto ask the user again if the approval did not name the plan', async () => {
    const world = await worldWithTwoArtifacts();

    await world.runtime.say({ treeId: world.treeId, text: 'Approved plan v1.' });
    await world.runtime.settled();

    expect(world.state.ports.autoTurns.at(-1)?.text ?? '').toContain(ASK_THE_USER);
  });

  it('lets Auto start the implementer on the approved plan, and the tree reads Build', async () => {
    const world = await worldWithTwoArtifacts();
    await approve({ world, told: [] });

    const outcome = await autoDelegates({ world, spec: IMPLEMENT });

    expect(outcome).toMatchObject({ isOk: true });
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((delegation) => delegation.role)).toEqual(['implementer']);
    expect(autoCardHeadOf({ delegations }).name).toBe('Build');
  });

  it('records nothing and tells Auto nothing on a second approve of the same version', async () => {
    const world = await worldWithTwoArtifacts();
    const told: Array<string> = [];
    await approve({ world, told });
    const before = await getAutoArtifact({ db: world.state.world.db, artifactId: PLAN });

    const second = await approve({ world, told });

    expect(second).toEqual({ kind: 'already_approved', revision: 1 });
    expect(told).toEqual(['Approved plan v1.']);
    expect(await userRowsOf(world)).toHaveLength(1);
    expect(await getAutoArtifact({ db: world.state.world.db, artifactId: PLAN })).toEqual(before);
  });

  it('sends one turn when two surfaces approve the same version at once', async () => {
    const world = await worldWithTwoArtifacts();
    const told: Array<string> = [];

    const results = await Promise.all([approve({ world, told }), approve({ world, told })]);

    expect(results.map((result) => result.kind).sort()).toEqual(['already_approved', 'approved']);
    expect(told).toEqual(['Approved plan v1.']);
  });

  it('stays a quiet no-op once the implementer took the plan', async () => {
    const world = await worldWithTwoArtifacts();
    await approve({ world, told: [] });
    await autoDelegates({ world, spec: IMPLEMENT });
    const send = vi.fn(async () => undefined);

    const again = await approveAutoPlan({
      db: world.state.world.db,
      sessionId: AUTO_SEED_SESSION,
      rootAgentId: AUTO_SEED_ROOT,
      artifactId: PLAN,
      expectedRevision: 1,
      send,
      onWritten: async () => undefined,
    });

    expect(again).toEqual({ kind: 'already_approved', revision: 1 });
    expect(send).not.toHaveBeenCalled();
  });
});
