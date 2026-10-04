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
import { buildTimelineStream } from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = new Date(2026, 7, 18, 12, 0);
const RUN_LANE = 'lane:run:run-1';
const STEP_GROUP = 'subagents:agent:build';
const STEP_GROUP_HEAD = `head:${STEP_GROUP}`;
const STEP_GROUP_LANE = `lane:${STEP_GROUP}`;
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
}: {
  readonly parent: string;
  readonly count: number;
}): ReadonlyArray<Agent> =>
  Array.from({ length: count }, (_, index) => ({
    id: `${parent}-sub${index}` as AgentId,
    sessionId: SESSION_ID,
    ordinal: 10 + index,
    name: `${parent}-sub${index}`,
    status: 'completed',
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

const streamOf = ({ expanded = [] }: { readonly expanded?: ReadonlyArray<string> }) => {
  const agents: ReadonlyArray<Agent> = [
    ...STEP_IDS.map((id, index) => stepAgent({ id, ordinal: index + 1 })),
    ...subagentsOf({ parent: 'build', count: 4 }),
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

describe('subagent group under a workflow step', () => {
  for (const expanded of [[], [STEP_GROUP]]) {
    it(`hangs the head from the step ball one column in, ${expanded.length === 0 ? 'closed' : 'open'}`, () => {
      const { items, groups, layout } = streamOf({ expanded });

      const head = groups.find((group) => group.id === STEP_GROUP_HEAD);
      expect(head?.parentGroupId).toBe(RUN_LANE);
      const runColumn = layout.columnByGroupId.get(RUN_LANE);
      expect(runColumn).toBeDefined();
      expect(layout.columnByGroupId.get(STEP_GROUP_HEAD)).toBe((runColumn ?? 0) + 1);

      const headRail = layout.rows[items.findIndex((item) => item.id === STEP_GROUP)];
      expect(headRail?.markerColumn).toBe((runColumn ?? 0) + 1);
      const stub = headRail?.joins.find((join) => join.kind === 'stub');
      expect(stub?.spineColumn).toBe(runColumn);
      expect(stub?.laneColumn).toBe((runColumn ?? 0) + 1);
    });
  }

  it('nests the opened lane one column right of the head and clear of the run lane', () => {
    const { layout } = streamOf({ expanded: [STEP_GROUP] });

    const runColumn = layout.columnByGroupId.get(RUN_LANE) ?? 0;
    expect(layout.columnByGroupId.get(STEP_GROUP_LANE)).toBe(runColumn + 2);
  });
});
