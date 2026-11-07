// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type IsoDateTime,
  type MountId,
  type PlanWithCount,
  type WorkflowRunId,
} from '@goodboy/types';
import { aProject, anAgent, nextSessionId, nextWorkflowRunId } from '@goodboy/types/testing';
import { aMountRow } from '../session/central/branches/testing/aMountRow';
import { aMountView } from '../session/testing/aMountView';
import type { WorkBranch } from '../session/workBranchesOf';
import { artifactBranchesOf } from './artifactBranchesOf';
import {
  groupArtifactRowsByBranch,
  type ArtifactBranchItem,
  type ArtifactListRow,
} from './artifactListRows';
import type { ArtifactGroup } from './artifactStateOf';

const SESSION = nextSessionId();
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const DUP_ROW = aMountRow({
  key: 'dup',
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY_ROW = aMountRow({
  key: 'retry',
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const MOUNT_ROWS = [DUP_ROW, RETRY_ROW];
const PROJECTS = [PAYMENTS, NOTIFY];
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });

const branchOf = (view: typeof DUP): WorkBranch => ({
  mountId: view.id,
  projectId: view.projectId,
  projectName: view.mountName,
  branch: view.branch,
  worktreePath: view.worktreePath,
});

type RowParams = {
  readonly id: string;
  readonly group?: ArtifactGroup;
};

const rowOf = ({ id, group = 'ready' }: RowParams): ArtifactListRow => ({
  id: `artifact:${id}`,
  target: { kind: 'artifact', artifactId: brandId<ArtifactId>({ value: id }) },
  kind: 'plan',
  title: id,
  state: null,
  group,
  at: AT,
  deletedAt: group === 'deleted' ? AT : null,
  partCount: 0,
  parts: [],
  runBy: null,
  isPlanRunning: false,
  isFaint: group === 'deleted',
});

type ItemParams = RowParams & {
  readonly branches?: ReadonlyArray<WorkBranch>;
};

const itemOf = ({ branches = [], ...row }: ItemParams): ArtifactBranchItem => ({
  row: rowOf(row),
  branches,
});

const rowIdsOf = (items: ReadonlyArray<ArtifactBranchItem>) => items.map((item) => item.row.id);

describe('groupArtifactRowsByBranch', () => {
  it('lists the branch that needs you first and the rows without a branch last', () => {
    const view = groupArtifactRowsByBranch({
      mounts: MOUNT_ROWS,
      items: [
        itemOf({ id: 'dup-ready', branches: [branchOf(DUP)] }),
        itemOf({ id: 'explain' }),
        itemOf({ id: 'retry-needs', group: 'needs', branches: [branchOf(RETRY)] }),
      ],
    });

    expect(view.groups.map((group) => group.head.kind)).toEqual(['branch', 'branch', 'none']);
    expect(view.groups.map((group) => group.key)).toEqual([
      `mount:${RETRY.id}`,
      `mount:${DUP.id}`,
      'none',
    ]);
  });

  it('draws a replicated artifact in each of its branches', () => {
    const view = groupArtifactRowsByBranch({
      mounts: MOUNT_ROWS,
      items: [itemOf({ id: 'both', branches: [branchOf(DUP), branchOf(RETRY)] })],
    });

    expect(view.groups.map((group) => rowIdsOf(group.items))).toEqual([
      ['artifact:both'],
      ['artifact:both'],
    ]);
  });

  it('sits a plan on a series once, in the series group', () => {
    const series = {
      seriesId: 'series-rec',
      name: 'Ledger reconciliation',
      position: 1,
      plannedCount: 2,
      label: '1',
    };
    const view = groupArtifactRowsByBranch({
      mounts: [
        { ...DUP_ROW, series },
        { ...RETRY_ROW, series: { ...series, position: 2, label: '2' } },
      ],
      items: [itemOf({ id: 'split', branches: [branchOf(DUP), branchOf(RETRY)] })],
    });

    expect(view.groups.map((group) => group.key)).toEqual(['series:series-rec']);
    expect(rowIdsOf(view.groups[0]?.items ?? [])).toEqual(['artifact:split']);
  });

  it('keeps the trash as its own group, with no branch in it', () => {
    const view = groupArtifactRowsByBranch({
      mounts: MOUNT_ROWS,
      items: [
        itemOf({ id: 'live', branches: [branchOf(DUP)] }),
        itemOf({ id: 'gone', group: 'deleted', branches: [branchOf(DUP)] }),
      ],
    });

    expect(view.deleted.map((row) => row.id)).toEqual(['artifact:gone']);
    expect(rowIdsOf(view.groups.flatMap((group) => group.items))).toEqual(['artifact:live']);
  });

  it('orders the rows of a branch by their state group', () => {
    const view = groupArtifactRowsByBranch({
      mounts: MOUNT_ROWS,
      items: [
        itemOf({ id: 'used', group: 'consumed', branches: [branchOf(DUP)] }),
        itemOf({ id: 'ready', group: 'ready', branches: [branchOf(DUP)] }),
        itemOf({ id: 'needs', group: 'needs', branches: [branchOf(DUP)] }),
      ],
    });

    expect(rowIdsOf(view.groups[0]?.items ?? [])).toEqual([
      'artifact:needs',
      'artifact:ready',
      'artifact:used',
    ]);
  });
});

const PLANNER_ID = brandId<AgentId>({ value: 'agent-planner' });
const RUN_ID: WorkflowRunId = nextWorkflowRunId();

const planOf = (patch: Partial<PlanWithCount>): PlanWithCount => ({
  id: brandId<ArtifactId>({ value: 'plan-1' }),
  sessionId: SESSION,
  agentId: PLANNER_ID,
  title: 'Plan',
  bodyMd: '## Goal',
  status: 'active',
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: 0,
  ...patch,
});

type BranchesParams = {
  readonly plan: PlanWithCount;
  readonly declared?: ReadonlyMap<AgentId, ReadonlyArray<MountId>>;
  readonly agents?: ReadonlyArray<ReturnType<typeof anAgent>>;
};

const branchesFor = ({ plan, declared = new Map(), agents = [] }: BranchesParams) =>
  artifactBranchesOf({
    row: rowOf({ id: plan.id }),
    plans: [plan],
    artifacts: [],
    mountIdsByAgentId: declared,
    agents,
    sessionMounts: [DUP, RETRY],
    projects: PROJECTS,
  }).map((branch) => branch.branch);

describe('artifactBranchesOf', () => {
  it('reads the mounts the plan declared before anything else', () => {
    const planner = anAgent({ id: PLANNER_ID, sessionId: SESSION, mountId: DUP.id });

    expect(
      branchesFor({
        plan: planOf({}),
        declared: new Map([[PLANNER_ID, [RETRY.id]]]),
        agents: [planner],
      }),
    ).toEqual(['feat/retry-budget']);
  });

  it('falls back to the branch of the agent that wrote it', () => {
    const planner = anAgent({ id: PLANNER_ID, sessionId: SESSION, mountId: DUP.id });

    expect(branchesFor({ plan: planOf({}), agents: [planner] })).toEqual(['fix/duplicate-credit']);
  });

  it('falls back to the branch of its run when the writer has none', () => {
    const planner = anAgent({ id: PLANNER_ID, sessionId: SESSION });
    const step = anAgent({ sessionId: SESSION, workflowRunId: RUN_ID, mountId: RETRY.id });

    expect(
      branchesFor({ plan: planOf({ workflowRunId: RUN_ID }), agents: [planner, step] }),
    ).toEqual(['feat/retry-budget']);
  });

  it('has no branch when nothing points at a mount', () => {
    const planner = anAgent({ id: PLANNER_ID, sessionId: SESSION });

    expect(branchesFor({ plan: planOf({}), agents: [planner] })).toEqual([]);
  });
});
