// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineRowItem } from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { needsYouOwners } from './needsYou';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = new Date(2026, 7, 18, 12, 0);
const RUN_ROW = 'run:run-1';
const RUN_LANE = 'lane:run:run-1';
const STEP_LANE = 'lane:agent:build';
const SUBAGENTS_ID = 'subagents:agent:build';
const STEP_IDS = ['scout', 'plan', 'build'] as const;

const at = ({ hour, minute = 0 }: { readonly hour: number; readonly minute?: number }) =>
  new Date(2026, 7, 18, hour, minute).toISOString() as IsoDateTime;

const stepAgent = ({ id, ordinal }: { readonly id: string; readonly ordinal: number }): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${id}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: id,
  status: 'completed',
  startedAt: at({ hour: 9, minute: ordinal * 10 }),
  completedAt: at({ hour: 9, minute: ordinal * 10 + 8 }),
});

const subagentsOf = ({
  parent,
  count,
  statuses = [],
}: {
  readonly parent: string;
  readonly count: number;
  readonly statuses?: ReadonlyArray<Agent['status']>;
}): ReadonlyArray<Agent> =>
  Array.from({ length: count }, (_, index) => ({
    id: `${parent}-sub${index}` as AgentId,
    sessionId: SESSION_ID,
    ordinal: 10 + index,
    name: `${parent}-sub${index}`,
    status: statuses[index] ?? 'completed',
    parentAgentId: parent as AgentId,
    startedAt: at({ hour: 9, minute: 31 + index }),
    completedAt: at({ hour: 9, minute: 32 + index }),
  }));

const workflow = (): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = 'workflow-1' as WorkflowId;
  const steps: ReadonlyArray<Step> = STEP_IDS.map((id, index) => ({
    id: `step-${id}` as StepId,
    workflowId,
    ordinal: index,
    name: id,
    promptPrefix: '',
  }));
  return {
    run: {
      id: RUN_ID,
      workflowId,
      ordinal: 0,
      currentStep: 2,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      createdAt: at({ hour: 9 }),
    },
    workflow: {
      id: workflowId,
      workspaceId: 'workspace-1' as WorkspaceId,
      name: 'Refund keys',
      description: '',
      steps,
      createdAt: at({ hour: 8 }),
      updatedAt: at({ hour: 8 }),
    },
  };
};

const streamOf = ({
  expanded = [],
  count = 4,
  statuses = [],
  folds = true,
}: {
  readonly expanded?: ReadonlyArray<string>;
  readonly count?: number;
  readonly statuses?: ReadonlyArray<Agent['status']>;
  readonly folds?: boolean;
}) => {
  const agents: ReadonlyArray<Agent> = [
    ...STEP_IDS.map((id, index) => stepAgent({ id, ordinal: index + 1 })),
    ...subagentsOf({ parent: 'build', count, statuses }),
  ];
  const entries = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: [workflow()],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [],
    agentKindOverride: {},
  }).entries;
  const stream = buildTimelineStream({
    entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at: when }) => dayLabel({ at: when, now: NOW }),
    expandedGroupIds: new Set(expanded),
    foldsFinished: folds,
  });
  return { ...stream, layout: layoutTimelineRail({ rows: stream.items, groups: stream.groups }) };
};

const rowsOf = (items: ReadonlyArray<{ readonly kind: string }>) =>
  items.filter((item): item is TimelineRowItem => item.kind === 'row');

describe('subagents under a workflow step', () => {
  it('draws no group row: the step has one count row above it while its subagents are folded', () => {
    const { items, groups } = streamOf({ expanded: [RUN_ROW] });
    const ids = rowsOf(items).map((row) => row.id);
    const build = rowsOf(items).find((row) => row.id === 'agent:build');
    const count = items.find((item) => item.kind === 'count' && item.expandId === SUBAGENTS_ID);

    expect(ids).toEqual(['agent:build', 'agent:plan', 'agent:scout', RUN_ROW]);
    expect(build?.branches).toEqual([{ expandId: SUBAGENTS_ID, isExpanded: false }]);
    expect(count?.kind === 'count' ? count.summary.total : null).toBe(4);
    expect(count?.kind === 'count' ? count.groupId : null).toBe(STEP_LANE);
    expect(items.findIndex((item) => item === count)).toBe(
      items.findIndex((item) => item.id === 'agent:build') - 1,
    );
    expect(groups.map((group) => group.id).sort()).toEqual([STEP_LANE, RUN_LANE]);
  });

  it('opens the children above the step, newest first, numbered 3.4 down to 3.1', () => {
    const { items } = streamOf({ expanded: [RUN_ROW, SUBAGENTS_ID] });
    const rows = rowsOf(items);

    expect(rows.map((row) => row.id)).toEqual([
      'agent:build-sub3',
      'agent:build-sub2',
      'agent:build-sub1',
      'agent:build-sub0',
      'agent:build',
      'agent:plan',
      'agent:scout',
      RUN_ROW,
    ]);
    expect(rows.slice(0, 5).map((row) => row.ordinal)).toEqual(['3.4', '3.3', '3.2', '3.1', '3']);
    expect(rows.slice(0, 4).every((row) => row.groupId === STEP_LANE)).toBe(true);
    expect(rows.slice(0, 4).map((row) => row.explode)).toEqual(
      Array.from({ length: 4 }, () => ({ groupId: SUBAGENTS_ID, kind: 'subagents' })),
    );
    expect(items.map((item) => item.id).slice(0, 3)).toEqual([
      'now',
      'count:run:run-1',
      `count:${SUBAGENTS_ID}`,
    ]);
  });

  for (const expanded of [[RUN_ROW], [RUN_ROW, SUBAGENTS_ID]]) {
    it(`reserves the child column on the step ball, ${expanded.length === 1 ? 'folded' : 'open'}`, () => {
      const { items, layout } = streamOf({ expanded });
      const stepIndex = items.findIndex((item) => item.id === 'agent:build');

      const runColumn = layout.columnByGroupId.get(RUN_LANE);
      expect(runColumn).toBe(1);
      expect(layout.columnByGroupId.get(STEP_LANE)).toBe(2);
      expect(layout.rows[stepIndex]?.markerColumn).toBe(runColumn);
      expect(layout.width).toBeGreaterThanOrEqual(8 + ((runColumn ?? 0) + 1) * 16);
    });
  }

  it('branches the child lane off the step ball and starts it at the count row on top', () => {
    const { items, groups, layout } = streamOf({ expanded: [RUN_ROW, SUBAGENTS_ID] });
    const stepRail = layout.rows[items.findIndex((item) => item.id === 'agent:build')];
    const countRail = layout.rows[items.findIndex((item) => item.id === `count:${SUBAGENTS_ID}`)];
    const lane = groups.find((group) => group.id === STEP_LANE);

    expect(lane).toEqual(
      expect.objectContaining({
        parentGroupId: RUN_LANE,
        originRowId: 'agent:build',
        direction: 'up',
      }),
    );
    expect(
      stepRail?.joins.map((join) => `${join.kind}:${join.spineColumn}->${join.laneColumn}`),
    ).toEqual(['branch:1->2']);
    expect(countRail?.markerColumn).toBe(2);
    const laneSegment = countRail?.segments.find((segment) => segment.column === 2);
    expect(laneSegment?.fromY).toBe(countRail?.markerY);
    expect(laneSegment?.toY).toBe(countRail?.height);
  });

  it('keeps the subagents shown while one has failed, with no count row to fold them under', () => {
    const { items } = streamOf({
      expanded: [RUN_ROW],
      statuses: ['completed', 'failed', 'completed', 'completed'],
    });
    const build = rowsOf(items).find((row) => row.id === 'agent:build');

    expect(items.some((item) => item.kind === 'count' && item.expandId === SUBAGENTS_ID)).toBe(
      false,
    );
    expect(rowsOf(items).map((row) => row.id)).toContain('agent:build-sub1');
    expect(build?.branches).toBeUndefined();
  });

  it('lists a run with a failed subagent in Needs you, because that stream never folds', () => {
    const statuses: ReadonlyArray<Agent['status']> = [
      'failed',
      'completed',
      'completed',
      'completed',
    ];
    const { items } = streamOf({ statuses, folds: false });

    expect(needsYouOwners({ items, entries: [], events: [] }).map((owner) => owner.id)).toEqual([
      RUN_ROW,
    ]);
  });

  it('shows the children of one step once, whether its count row is folded or open', () => {
    const { items: folded } = streamOf({ expanded: [RUN_ROW] });
    const { items: open } = streamOf({ expanded: [RUN_ROW, SUBAGENTS_ID] });

    expect(rowsOf(folded).filter((row) => row.id.startsWith('agent:build-sub'))).toHaveLength(0);
    expect(rowsOf(open).filter((row) => row.id.startsWith('agent:build-sub'))).toHaveLength(4);
  });
});
