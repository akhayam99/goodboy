// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoArtifactLedgerRow, AutoDelegation } from '@goodboy/db';
import { brandId, type AgentId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import {
  aDelegation,
  anArtifactRow,
  aPlanRow,
  aView,
  FIXTURE_NOW,
} from './testing/autoViewFixtures';
import { dockPlanOf } from './dockPlanOf';
import { planBlockedReasonOf } from './planBlockedReasonOf';

type PlanTwoParams = {
  readonly createdAt: number;
};

const planTwoOf = ({ createdAt }: PlanTwoParams): AutoArtifactLedgerRow => {
  const base = aPlanRow({ title: 'FTUE home and discover' });
  return {
    ...base,
    artifact: {
      ...base.artifact,
      artifactId: brandId<ArtifactId>({ value: 'artifact-plan-2' }),
      ownerAgentId: brandId<AgentId>({ value: 'agent-planner-2' }),
      ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-planner-2' }),
      createdAt,
    },
    updatedAt: createdAt,
  };
};

type PlannerParams = {
  readonly state: AutoDelegation['state'];
  readonly outcome?: AutoDelegation['outcome'];
  readonly request?: Readonly<Record<string, unknown>>;
};

const newPlannerOf = ({ state, outcome = null, request = {} }: PlannerParams): AutoDelegation => {
  const base = aDelegation({ key: 'planner-2', role: 'planner', state, outcome });
  return { ...base, createdAt: FIXTURE_NOW + 1_000, request: { ...base.request, ...request } };
};

const owner = aDelegation({
  key: 'planner',
  role: 'planner',
  state: 'settled',
  outcome: 'completed',
});

describe('dockPlanOf', () => {
  it('takes the plan that waits for you over a newer or older plan', () => {
    const newest = {
      ...anArtifactRow({ id: 'artifact-plan-3', kind: 'plan', title: 'C' }),
      status: 'consumed',
    } as const;
    const waiting = anArtifactRow({ id: 'artifact-plan-2', kind: 'plan', title: 'B', revision: 2 });
    const oldest = {
      ...anArtifactRow({ id: 'artifact-plan-1', kind: 'plan', title: 'A' }),
      status: 'consumed',
    } as const;

    const plan = dockPlanOf({ view: aView({ artifacts: [newest, waiting, oldest] }) });

    expect(plan).toMatchObject({ kind: 'waiting', version: 2 });
    expect(plan?.row.artifact.artifactId).toBe('artifact-plan-2');
  });

  it('settles on the newest plan when none waits, and says null without a plan', () => {
    const newest = {
      ...anArtifactRow({ id: 'artifact-plan-2', kind: 'plan', title: 'B' }),
      status: 'consumed',
    } as const;
    const report = anArtifactRow({ id: 'artifact-report', kind: 'report', title: 'R' });

    expect(dockPlanOf({ view: aView({ artifacts: [newest, report] }) })?.kind).toBe('settled');
    expect(dockPlanOf({ view: aView({ artifacts: [report] }) })).toBeNull();
  });

  it('never asks for a plan whose artifact was discarded or whose planner was removed', () => {
    const discarded = { ...aPlanRow(), status: 'discarded' } as const;
    const hidden = { ...aView({ artifacts: [aPlanRow()] }), hiddenChildIds: [owner.childAgentId] };

    expect(dockPlanOf({ view: aView({ artifacts: [discarded] }) })).toBeNull();
    expect(dockPlanOf({ view: hidden })).toBeNull();
  });

  it('updates plan v1 to v2 while a revise is open, with Approve blocked', () => {
    const revise = aDelegation({
      key: 'revise',
      role: 'planner',
      state: 'running',
      reviseOf: 'artifact-plan',
      baseRevision: 1,
    });
    const view = aView({
      delegations: [owner, revise],
      artifacts: [aPlanRow({ approvalState: 'revising', openRevise: 'delegation-revise' })],
    });

    const plan = dockPlanOf({ view });

    expect(plan).toMatchObject({ kind: 'updating', version: 1, planner: { id: revise.id } });
    expect(plan === null ? null : planBlockedReasonOf({ plan })).toBe(
      'The Planner is writing plan v2',
    );
  });

  it('updates plan v1 while the Lead delegates a new planner, then asks for v2 and marks v1 superseded', () => {
    const running = aView({
      delegations: [owner, newPlannerOf({ state: 'running' })],
      artifacts: [aPlanRow()],
    });

    expect(dockPlanOf({ view: running })).toMatchObject({ kind: 'updating', version: 1 });

    const written = aView({
      delegations: [owner, newPlannerOf({ state: 'settled', outcome: 'completed' })],
      artifacts: [aPlanRow(), planTwoOf({ createdAt: FIXTURE_NOW + 2_000 })],
    });
    const plan = dockPlanOf({ view: written });

    expect(plan).toMatchObject({ kind: 'waiting', version: 2 });
    expect(plan?.row.artifact.artifactId).toBe('artifact-plan-2');
  });

  it('reads a change sent for v1 as updating, and drops it once v2 is there', () => {
    const sent = { artifactId: 'artifact-plan', revision: 1 };
    const atOne = { ...aView({ artifacts: [aPlanRow()] }), sentChange: sent };
    const atTwo = { ...aView({ artifacts: [aPlanRow({ revision: 2 })] }), sentChange: sent };

    expect(dockPlanOf({ view: atOne })).toMatchObject({ kind: 'updating', by: 'lead' });
    expect(dockPlanOf({ view: atTwo })).toMatchObject({ kind: 'waiting', version: 2 });
  });

  it('says plan v2 failed with the reason, and asks for v1 again only after Keep', () => {
    const failed = aView({
      delegations: [owner, newPlannerOf({ state: 'settled', outcome: 'failed' })],
      artifacts: [aPlanRow()],
    });
    const kept = aView({
      delegations: [
        owner,
        newPlannerOf({
          state: 'settled',
          outcome: 'failed',
          request: { keptBase: { artifactId: 'artifact-plan', revision: 1 } },
        }),
      ],
      artifacts: [aPlanRow()],
    });

    expect(dockPlanOf({ view: failed })).toMatchObject({ kind: 'failed', version: 1 });
    expect(dockPlanOf({ view: kept })).toMatchObject({ kind: 'waiting', version: 1 });
  });

  it('drops a late failure of a revise for v1 once the plan is at v2', () => {
    const late = aDelegation({
      key: 'revise',
      role: 'planner',
      state: 'settled',
      outcome: 'failed',
      reviseOf: 'artifact-plan',
      baseRevision: 1,
    });
    const view = aView({ delegations: [owner, late], artifacts: [aPlanRow({ revision: 2 })] });

    expect(dockPlanOf({ view })).toMatchObject({ kind: 'waiting', version: 2 });
  });

  it('asks for v1 again when the Lead discards the new planner before it writes', () => {
    const discarded = newPlannerOf({
      state: 'settled',
      outcome: 'stopped',
      request: { closed: { as: 'discarded', reason: 'not needed' } },
    });
    const view = aView({ delegations: [owner, discarded], artifacts: [aPlanRow()] });

    expect(dockPlanOf({ view })).toMatchObject({ kind: 'waiting', version: 1 });
  });
});
