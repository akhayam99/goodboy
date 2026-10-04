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
import { firstNeedsYouRowId, needsYouCount } from './needsYou';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = new Date(2026, 7, 18, 12, 0);
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
}: {
  readonly expanded?: ReadonlyArray<string>;
  readonly count?: number;
  readonly statuses?: ReadonlyArray<Agent['status']>;
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
    foldsFinished: false,
  });
  return { ...stream, layout: layoutTimelineRail({ rows: stream.items, groups: stream.groups }) };
};

const rowsOf = (items: ReadonlyArray<{ readonly kind: string }>) =>
  items.filter((item): item is TimelineRowItem => item.kind === 'row');

describe('subagents under a workflow step', () => {
  it('draws no group row: the step carries its subagents in its own row, closed', () => {
    const { items, groups } = streamOf({});
    const ids = rowsOf(items).map((row) => row.id);
    const build = rowsOf(items).find((row) => row.id === 'agent:build');

    expect(ids).toEqual(['run:run-1', 'agent:scout', 'agent:plan', 'agent:build']);
    expect(build?.subagents?.summary.total).toBe(4);
    expect(build?.subagents?.id).toBe(SUBAGENTS_ID);
    expect(build?.subagents?.isExpanded).toBe(false);
    expect(build?.opensLane).toBe(true);
    expect(groups.map((group) => group.id)).toEqual([RUN_LANE]);
  });

  it('opens the children right under the step, numbered 3.1 onward', () => {
    const { items } = streamOf({ expanded: [SUBAGENTS_ID] });
    const rows = rowsOf(items);

    expect(rows.map((row) => row.id)).toEqual([
      'run:run-1',
      'agent:scout',
      'agent:plan',
      'agent:build',
      'agent:build-sub0',
      'agent:build-sub1',
      'agent:build-sub2',
      'agent:build-sub3',
    ]);
    expect(rows.slice(3).map((row) => row.ordinal)).toEqual(['3', '3.1', '3.2', '3.3', '3.4']);
    expect(rows.slice(4).every((row) => row.groupId === STEP_LANE)).toBe(true);
    expect(rows.slice(4).map((row) => row.explode)).toEqual(
      Array.from({ length: 4 }, () => ({ groupId: SUBAGENTS_ID, kind: 'subagents' })),
    );
  });

  for (const expanded of [[], [SUBAGENTS_ID]]) {
    it(`reserves the child column on the step ball, ${expanded.length === 0 ? 'closed' : 'open'}`, () => {
      const { items, layout } = streamOf({ expanded });
      const stepIndex = items.findIndex((item) => item.id === 'agent:build');

      const runColumn = layout.columnByGroupId.get(RUN_LANE);
      expect(runColumn).toBe(1);
      expect(layout.rows[stepIndex]?.markerColumn).toBe(runColumn);
      expect(layout.width).toBeGreaterThanOrEqual(8 + ((runColumn ?? 0) + 1) * 16);
    });
  }

  it('forks the child lane off the step ball and ends it on the last child', () => {
    const { items, groups, layout } = streamOf({ expanded: [SUBAGENTS_ID] });
    const stepRail = layout.rows[items.findIndex((item) => item.id === 'agent:build')];
    const lastRail = layout.rows[items.findIndex((item) => item.id === 'agent:build-sub3')];
    const lane = groups.find((group) => group.id === STEP_LANE);

    expect(lane).toEqual(
      expect.objectContaining({
        parentGroupId: RUN_LANE,
        originRowId: 'agent:build',
        direction: 'down',
      }),
    );
    expect(layout.columnByGroupId.get(STEP_LANE)).toBe(2);
    expect(
      stepRail?.joins.map((join) => `${join.kind}:${join.spineColumn}->${join.laneColumn}`),
    ).toEqual(['fork:1->2']);
    expect(lastRail?.markerColumn).toBe(2);
    const laneSegment = lastRail?.segments.find((segment) => segment.column === 2);
    expect(laneSegment?.fromY).toBe(0);
    expect(laneSegment?.toY).toBe(lastRail?.markerY);
  });

  it('shows a failed child on the closed step row without opening it', () => {
    const { items } = streamOf({ statuses: ['completed', 'failed', 'completed', 'completed'] });
    const build = rowsOf(items).find((row) => row.id === 'agent:build');

    expect(build?.subagents?.summary.failedCount).toBe(1);
    expect(build?.subagents?.attentionKeys).toEqual(['agent:build-sub1']);
  });

  it('counts a failed child once for the need-you chip, closed or open', () => {
    const statuses: ReadonlyArray<Agent['status']> = [
      'failed',
      'completed',
      'completed',
      'completed',
    ];
    const closed = streamOf({ statuses });
    const open = streamOf({ statuses, expanded: [SUBAGENTS_ID] });

    expect(needsYouCount({ items: closed.items })).toBe(1);
    expect(needsYouCount({ items: open.items })).toBe(1);
    expect(firstNeedsYouRowId({ items: closed.items })).toBe('agent:build');
  });

  it('counts the children of one step once, whether the step is closed or open', () => {
    const { items: closed } = streamOf({});
    const { items: open } = streamOf({ expanded: [SUBAGENTS_ID] });

    expect(rowsOf(closed).filter((row) => row.id.startsWith('agent:build-sub'))).toHaveLength(0);
    expect(rowsOf(open).filter((row) => row.id.startsWith('agent:build-sub'))).toHaveLength(4);
  });
});
