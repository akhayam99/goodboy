// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  SessionArtifact,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowExecutionMode,
  WorkflowId,
  WorkflowOrchestrationOutcome,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { WorkflowAdvanceState } from '../../workflows/advanceGate';
import { buildTimelineGroups } from './buildTimelineGroups';
import {
  buildRunTreeStream,
  buildTimelineStream,
  type TimelineStreamItem,
  type TimelineRowItem,
} from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { needsYouOwners } from './needsYou';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';
import { rowStateNode, rowStateTone } from '../../workTreeModel/rowStateCopy';
import { runIdentity, runIdentitySeed } from './runIdentity';
import { markerCenterY, TIMELINE_RHYTHM } from '../../workTreeModel/timelineRhythm';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });
const RUN_ID = typedString<WorkflowRunId>({ value: 'run-1' });
const OTHER_RUN_ID = typedString<WorkflowRunId>({ value: 'run-2' });

const NOW = new Date(2026, 7, 18, 12, 0);

const localIso = ({
  day,
  hour,
  minute = 0,
}: {
  readonly day: number;
  readonly hour: number;
  readonly minute?: number;
}): string => new Date(2026, 7, day, hour, minute).toISOString();

type AgentParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: string;
  readonly status?: Agent['status'];
  readonly lastFinishedAt?: string;
  readonly doneAt?: string;
};

const agent = ({
  id,
  ordinal,
  startedAt,
  completedAt,
  workflowRunId,
  parentAgentId,
  status = 'completed',
  lastFinishedAt,
  doneAt,
}: AgentParams): Agent => ({
  id: typedString<AgentId>({ value: id }),
  sessionId: SESSION_ID,
  stepId:
    workflowRunId != null && parentAgentId == null
      ? typedString<StepId>({ value: `step-${id}` })
      : undefined,
  workflowRunId,
  ...(parentAgentId != null
    ? { parentAgentId: typedString<AgentId>({ value: parentAgentId }) }
    : {}),
  ordinal,
  name: id,
  status,
  ...(startedAt != null ? { startedAt: typedString<IsoDateTime>({ value: startedAt }) } : {}),
  ...(completedAt != null ? { completedAt: typedString<IsoDateTime>({ value: completedAt }) } : {}),
  ...(lastFinishedAt != null
    ? { lastFinishedAt: typedString<IsoDateTime>({ value: lastFinishedAt }) }
    : {}),
  ...(doneAt != null ? { doneAt: typedString<IsoDateTime>({ value: doneAt }) } : {}),
});

type WorkflowParams = {
  readonly runId?: WorkflowRunId;
  readonly name?: string;
  readonly createdAt: string;
  readonly stepIds?: ReadonlyArray<string>;
  readonly executionMode?: WorkflowExecutionMode;
  readonly orchestrationOutcome?: WorkflowOrchestrationOutcome;
};

const attachedWorkflow = ({
  runId = RUN_ID,
  name = 'Release workflow',
  createdAt,
  stepIds = [],
  executionMode = 'static',
  orchestrationOutcome,
}: WorkflowParams): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = typedString<WorkflowId>({ value: `workflow-${runId}` });
  const steps: ReadonlyArray<Step> = stepIds.map((stepId, index) => ({
    id: typedString<StepId>({ value: `step-${stepId}` }),
    workflowId,
    ordinal: index,
    name: stepId,
    promptPrefix: '',
  }));
  return {
    run: {
      id: runId,
      workflowId,
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode,
      ...(orchestrationOutcome != null ? { orchestrationOutcome } : {}),
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
    },
    workflow: {
      id: workflowId,
      workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
      name,
      description: '',
      steps,
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
      updatedAt: typedString<IsoDateTime>({ value: createdAt }),
    },
  };
};

const RUN_WITH_PENDING_AGENTS: ReadonlyArray<Agent> = [
  agent({
    id: 'plan',
    ordinal: 1,
    startedAt: localIso({ day: 18, hour: 9 }),
    completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
    workflowRunId: RUN_ID,
  }),
  agent({
    id: 'implement',
    ordinal: 2,
    status: 'running',
    startedAt: localIso({ day: 18, hour: 10 }),
    workflowRunId: RUN_ID,
  }),
  agent({ id: 'test', ordinal: 3, status: 'pending', workflowRunId: RUN_ID }),
  agent({ id: 'review', ordinal: 4, status: 'pending', workflowRunId: RUN_ID }),
  agent({ id: 'ship', ordinal: 5, status: 'pending', workflowRunId: RUN_ID }),
  agent({ id: 'built-by-hand', ordinal: 6, startedAt: localIso({ day: 18, hour: 11 }) }),
];

type StreamParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows?: ReadonlyArray<ReturnType<typeof attachedWorkflow>>;
  readonly unreadAgentIds?: ReadonlySet<string>;
  readonly decidingRunIds?: ReadonlySet<string>;
  readonly advanceByRunId?: ReadonlyMap<string, WorkflowAdvanceState>;
  readonly events?: ReadonlyArray<SessionEvent>;
  readonly plans?: ReadonlyArray<PlanWithCount>;
  readonly artifacts?: ReadonlyArray<SessionArtifact>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly showQuestions?: boolean;
  readonly expanded?: ReadonlyArray<string>;
  readonly folds?: boolean;
};

const stream = ({
  agents,
  workflows = [],
  unreadAgentIds = new Set(),
  decidingRunIds = new Set(),
  advanceByRunId = new Map(),
  events = [],
  plans = [],
  artifacts = [],
  questions = [],
  showQuestions,
  expanded = [],
  folds = false,
}: StreamParams) =>
  buildTimelineStream({
    entries: buildTimelineGroups({
      sessionId: SESSION_ID,
      agents,
      workflows,
      plans,
      artifacts,
      externalTasks: [],
      questions,
      worktrees: [],
      events,
      agentKindOverride: {},
    }).entries,
    unreadAgentIds,
    advanceByRunId,
    decidingRunIds,
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
    ...(showQuestions != null ? { showQuestions } : {}),
    expandedGroupIds: new Set(expanded),
    foldsFinished: folds,
  });

type LaneSpan = {
  readonly from: number;
  readonly to: number;
};

type LaneSpanParams = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly layout: ReturnType<typeof layoutTimelineRail>;
};

const laneSpansOf = ({ items, layout }: LaneSpanParams): ReadonlyArray<LaneSpan> => {
  const spans: LaneSpan[] = [];
  let offset = 0;
  for (const [index, item] of items.entries()) {
    const rail = layout.rows[index];
    for (const segment of rail?.segments ?? []) {
      if (segment.column > 0) {
        spans.push({ from: offset + segment.fromY, to: offset + segment.toY });
      }
    }
    for (const join of rail?.joins ?? []) {
      spans.push(
        join.kind === 'fork'
          ? { from: offset + join.anchorY, to: offset + item.height }
          : { from: offset, to: offset + join.anchorY },
      );
    }
    offset += item.height;
  }
  return [...spans].sort((first, second) => first.from - second.from);
};

const topOfItem = ({
  items,
  index,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly index: number;
}): number => items.slice(0, index).reduce((total, item) => total + item.height, 0);

const stateOf = (item: TimelineStreamItem | undefined): string | null => {
  if (item?.kind !== 'row') {
    return null;
  }
  const { phase, reason } = item.rowState;
  return reason == null ? phase : `${phase}:${reason.kind}`;
};

const labelOf = (item: TimelineStreamItem): string => {
  if (item.kind === 'row') {
    return `${item.grade}:${item.id}`;
  }
  if (item.kind === 'day') {
    return `day:${item.label}`;
  }
  if (item.kind === 'count') {
    return `count:${item.expandId}`;
  }
  if (item.kind === 'more') {
    return 'more';
  }
  return 'now';
};

const labelsOf = (items: ReadonlyArray<TimelineStreamItem>): ReadonlyArray<string> =>
  items.map(labelOf);

const timesDownTheFeed = (items: ReadonlyArray<TimelineStreamItem>): ReadonlyArray<string> =>
  items.flatMap((item) => (item.kind === 'row' && item.at != null ? [item.at] : []));

const indexOfId = ({
  items,
  id,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly id: string;
}): number => items.findIndex((item) => item.id === id);

describe('buildTimelineStream', () => {
  describe('an agent started between two steps of a run (#1546)', () => {
    const agentsWith = ({ second }: { readonly second: 'queued' | 'running' }) => [
      agent({
        id: 'scout',
        ordinal: 1,
        startedAt: localIso({ day: 18, hour: 9 }),
        completedAt: localIso({ day: 18, hour: 9, minute: 20 }),
        workflowRunId: RUN_ID,
      }),
      agent({
        id: 'hand-agent',
        ordinal: 2,
        status: 'running',
        startedAt: localIso({ day: 18, hour: 9, minute: 21 }),
      }),
      second === 'queued'
        ? agent({ id: 'build', ordinal: 3, status: 'pending', workflowRunId: RUN_ID })
        : agent({
            id: 'build',
            ordinal: 3,
            status: 'running',
            startedAt: localIso({ day: 18, hour: 9, minute: 30 }),
            workflowRunId: RUN_ID,
          }),
    ];

    for (const second of ['queued', 'running'] as const) {
      it(`seats it by its own time between the run steps, with the lane running past it (${second})`, () => {
        const { items, groups } = stream({
          workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 9 }) })],
          agents: agentsWith({ second }),
        });
        const order = items.filter((item) => item.kind === 'row').map((item) => item.id);

        expect(order).toEqual(['agent:build', 'agent:hand-agent', 'agent:scout', 'run:run-1']);
        const layout = layoutTimelineRail({ rows: items, groups });
        const handRail = layout.rows[indexOfId({ items, id: 'agent:hand-agent' })];
        expect(handRail?.markerColumn).toBe(0);
        expect(handRail?.segments.filter((segment) => segment.column > 0)).toHaveLength(1);
      });
    }
  });

  it('puts the day label of the newest group under NOW when that day is not today', () => {
    const { items } = stream({
      agents: [
        agent({ id: 'older', ordinal: 1, startedAt: localIso({ day: 11, hour: 9 }) }),
        agent({ id: 'oldest', ordinal: 2, startedAt: localIso({ day: 11, hour: 8 }) }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'day:Aug 11',
      'entry:agent:oldest',
      'entry:agent:older',
    ]);
  });

  it('leaves the newest group unlabelled when it is from today', () => {
    const { items } = stream({
      agents: [
        agent({ id: 'today', ordinal: 2, startedAt: localIso({ day: 18, hour: 9 }) }),
        agent({ id: 'before', ordinal: 1, startedAt: localIso({ day: 11, hour: 9 }) }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'entry:agent:today',
      'day:Aug 11',
      'entry:agent:before',
    ]);
  });

  it('puts the steps above the run row, newest first, so the run reads up like the feed', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          startedAt: localIso({ day: 18, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'three',
          ordinal: 3,
          startedAt: localIso({ day: 18, hour: 11 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'step:agent:three',
      'step:agent:two',
      'step:agent:one',
      'entry:run:run-1',
    ]);
  });

  it('numbers the steps of a run so the ordinals fall down the list', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'first',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'second',
          ordinal: 2,
          startedAt: localIso({ day: 18, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'third',
          ordinal: 3,
          startedAt: localIso({ day: 18, hour: 11 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const ordinals = items.flatMap((item) =>
      item.kind === 'row' && item.ordinal != null ? [item.ordinal] : [],
    );

    expect(ordinals).toEqual(['3', '2', '1']);
  });

  it('keeps a queued step above the dated steps of an old unfinished run, under NOW', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 10, hour: 8 }) })],
      agents: [
        agent({
          id: 'done',
          ordinal: 1,
          startedAt: localIso({ day: 10, hour: 9 }),
          completedAt: localIso({ day: 10, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'todo', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:todo',
      'day:Aug 10',
      'step:agent:done',
      'entry:run:run-1',
    ]);
  });

  it('draws a settled run from yesterday step by step when folding is off', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 17, hour: 8 }) })],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 17, hour: 9 }),
          completedAt: localIso({ day: 17, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          startedAt: localIso({ day: 17, hour: 10 }),
          completedAt: localIso({ day: 17, hour: 10, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'day:Yesterday',
      'step:agent:two',
      'step:agent:one',
      'entry:run:run-1',
    ]);
  });

  it('orders runs newest first and keeps each run above its own row', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 12, hour: 8 }) }),
        attachedWorkflow({
          runId: OTHER_RUN_ID,
          name: 'Refactor workflow',
          createdAt: localIso({ day: 12, hour: 11 }),
        }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 12, hour: 9 }),
          completedAt: localIso({ day: 12, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          startedAt: localIso({ day: 12, hour: 12 }),
          completedAt: localIso({ day: 12, hour: 13 }),
          workflowRunId: OTHER_RUN_ID,
        }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'day:Aug 12',
      'step:agent:two',
      'entry:run:run-2',
      'step:agent:one',
      'entry:run:run-1',
    ]);
  });

  it('emits a day divider once for a day and again only where another day meets it', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 12, hour: 8 }) })],
      agents: [
        agent({
          id: 'old',
          ordinal: 1,
          startedAt: localIso({ day: 12, hour: 9 }),
          completedAt: localIso({ day: 12, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'loose', ordinal: 2, startedAt: localIso({ day: 12, hour: 11 }) }),
      ],
    });

    expect(items.filter((item) => item.kind === 'day')).toHaveLength(1);
    expect(labelsOf(items)).toEqual([
      'now',
      'day:Aug 12',
      'entry:agent:loose',
      'step:agent:old',
      'entry:run:run-1',
    ]);
  });

  it('lists every queued step above the running one, the last queued on top', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'running',
          ordinal: 1,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'next', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'later', ordinal: 3, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'last', ordinal: 4, status: 'pending', workflowRunId: RUN_ID }),
      ],
    });
    const queued = items.filter((item) => item.kind === 'row' && item.grade === 'pending');

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:last',
      'pending:agent:later',
      'pending:agent:next',
      'step:agent:running',
      'entry:run:run-1',
    ]);
    expect(queued.map((item) => item.height)).toEqual([
      TIMELINE_RHYTHM.grade.pending.height,
      TIMELINE_RHYTHM.grade.pending.height + TIMELINE_RHYTHM.gap.sibling,
      TIMELINE_RHYTHM.grade.pending.height + TIMELINE_RHYTHM.gap.sibling,
    ]);
    expect(queued.map(stateOf)).toEqual(['queued', 'queued', 'queued']);
  });

  it('leaves one lone queued step on the dashed stretch above the running step', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'running',
          ordinal: 1,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'next', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
      ],
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:next',
      'step:agent:running',
      'entry:run:run-1',
    ]);
  });

  it('keeps queued steps at the top, above everything that already ran', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: RUN_WITH_PENDING_AGENTS,
    });

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:ship',
      'pending:agent:review',
      'pending:agent:test',
      'entry:agent:built-by-hand',
      'step:agent:implement',
      'step:agent:plan',
      'entry:run:run-1',
    ]);
  });

  it('runs one unbroken lane from the run marker up to NOW while the run is live', () => {
    const { items, groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: RUN_WITH_PENDING_AGENTS,
    });
    const layout = layoutTimelineRail({ rows: items, groups });
    const spans = laneSpansOf({ items, layout });
    const originIndex = indexOfId({ items, id: 'run:run-1' });
    const breaks = spans.filter((span, index) => {
      const previous = spans[index - 1];
      return previous !== undefined && span.from > previous.to;
    });

    expect(spans[0]?.from).toBe(TIMELINE_RHYTHM.now.ruleY);
    expect(spans.at(-1)?.to).toBe(
      topOfItem({ items, index: originIndex }) + (layout.rows[originIndex]?.markerY ?? 0),
    );
    expect(breaks).toEqual([]);
    expect(groups.find((group) => group.id === 'lane:run:run-1')?.shape).toBe('open');
  });

  it('branches the lane off the run marker and dashes the queued stretch of a live run', () => {
    const { items, groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: RUN_WITH_PENDING_AGENTS,
    });
    const layout = layoutTimelineRail({ rows: items, groups });
    const queuedIndex = items.findIndex((item) => item.kind === 'row' && item.grade === 'pending');
    const originIndex = indexOfId({ items, id: 'run:run-1' });
    const queuedRail = layout.rows[queuedIndex];
    const originRail = layout.rows[originIndex];

    expect(originRail?.joins.map((join) => `${join.kind}:${join.dash}`)).toEqual(['branch:solid']);
    expect(originRail?.joins[0]?.anchorY).toBe(originRail?.markerY);
    expect(queuedRail?.joins).toEqual([]);
    expect(
      queuedRail?.segments
        .filter((segment) => segment.column > 0)
        .map((segment) => `${segment.dash}:${segment.fromY}-${segment.toY}`),
    ).toEqual([`dashed:0-${queuedRail?.height}`]);
    expect(queuedRail?.markerColumn).toBe(1);
  });

  it('lists the queued steps above the open subagents of the running step', () => {
    const settledStep = ({ id, ordinal }: { readonly id: string; readonly ordinal: number }) =>
      agent({
        id,
        ordinal,
        startedAt: localIso({ day: 18, hour: 8, minute: ordinal * 10 }),
        completedAt: localIso({ day: 18, hour: 8, minute: ordinal * 10 + 5 }),
        workflowRunId: RUN_ID,
      });
    const { items, groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      folds: true,
      agents: [
        settledStep({ id: 'step-1', ordinal: 1 }),
        settledStep({ id: 'step-2', ordinal: 2 }),
        settledStep({ id: 'step-3', ordinal: 3 }),
        agent({
          id: 'step-4',
          ordinal: 4,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'step-5', ordinal: 5, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'step-6', ordinal: 6, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'step-7', ordinal: 7, status: 'pending', workflowRunId: RUN_ID }),
        agent({
          id: 'child-1',
          ordinal: 8,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
          workflowRunId: RUN_ID,
          parentAgentId: 'step-4',
        }),
        agent({
          id: 'child-2',
          ordinal: 9,
          status: 'pending',
          workflowRunId: RUN_ID,
          parentAgentId: 'step-4',
        }),
      ],
    });
    const queued = items.flatMap((item) =>
      item.kind === 'row' && item.grade === 'pending' ? [item] : [],
    );
    const layout = layoutTimelineRail({ rows: items, groups });
    const stepFourIndex = indexOfId({ items, id: 'agent:step-4' });
    const childQueuedIndex = indexOfId({ items, id: 'agent:child-2' });

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:step-7',
      'pending:agent:step-6',
      'pending:agent:step-5',
      'pending:agent:child-2',
      'step:agent:child-1',
      'step:agent:step-4',
      'step:agent:step-3',
      'step:agent:step-2',
      'step:agent:step-1',
      'entry:run:run-1',
    ]);
    expect(queued.map((item) => item.ordinal)).toEqual(['7', '6', '5', '4.2']);
    expect(groups.find((group) => group.id === 'lane:agent:step-4')?.direction).toBe('up');
    expect(
      layout.rows[stepFourIndex]?.joins.map(
        (join) => `${join.kind}:${join.laneColumn}->${join.spineColumn}:${join.dash}`,
      ),
    ).toEqual(['branch:2->1:solid']);
    expect(layout.rows[childQueuedIndex]?.joins).toEqual([]);
  });

  it('keeps two concurrent runs on their own lanes, side by side up to NOW', () => {
    const { items, groups } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) }),
        attachedWorkflow({
          runId: OTHER_RUN_ID,
          name: 'Refactor workflow',
          createdAt: localIso({ day: 18, hour: 10 }),
        }),
      ],
      agents: [
        agent({
          id: 'a-done',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'a-next', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'a-last', ordinal: 3, status: 'pending', workflowRunId: RUN_ID }),
        agent({
          id: 'b-running',
          ordinal: 4,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 10, minute: 30 }),
          workflowRunId: OTHER_RUN_ID,
        }),
        agent({ id: 'b-next', ordinal: 5, status: 'pending', workflowRunId: OTHER_RUN_ID }),
        agent({ id: 'b-last', ordinal: 6, status: 'pending', workflowRunId: OTHER_RUN_ID }),
      ],
    });
    const layout = layoutTimelineRail({ rows: items, groups });
    const queued = items.flatMap((item, index) =>
      item.kind === 'row' && item.grade === 'pending' ? [{ item, rail: layout.rows[index] }] : [],
    );
    const seed = runIdentitySeed({ sessionId: SESSION_ID });

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:b-last',
      'pending:agent:b-next',
      'pending:agent:a-last',
      'pending:agent:a-next',
      'step:agent:b-running',
      'entry:run:run-2',
      'step:agent:a-done',
      'entry:run:run-1',
    ]);
    expect(queued.map(({ item }) => item.groupId)).toEqual([
      'lane:run:run-2',
      'lane:run:run-2',
      'lane:run:run-1',
      'lane:run:run-1',
    ]);
    expect(queued.map(({ item }) => item.identity?.index)).toEqual([
      runIdentity({ laneIndex: 1, seed }).index,
      runIdentity({ laneIndex: 1, seed }).index,
      runIdentity({ laneIndex: 0, seed }).index,
      runIdentity({ laneIndex: 0, seed }).index,
    ]);
    expect(queued.map(({ rail }) => rail?.markerColumn)).toEqual([1, 1, 2, 2]);
    expect(queued.map(({ rail }) => rail?.joins)).toEqual([[], [], [], []]);
    expect(layout.columnByGroupId.get('lane:run:run-2')).toBe(1);
    expect(layout.columnByGroupId.get('lane:run:run-1')).toBe(2);
  });

  it('gives a lone queued step no borrowed clock and keeps its day rule below it', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 10, hour: 8 }) })],
      agents: [
        agent({
          id: 'done',
          ordinal: 1,
          startedAt: localIso({ day: 10, hour: 9 }),
          completedAt: localIso({ day: 10, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'todo', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'built-by-hand', ordinal: 3, startedAt: localIso({ day: 18, hour: 11 }) }),
      ],
    });
    const pending = items.find((item) => item.id === 'agent:todo');

    expect(labelsOf(items)).toEqual([
      'now',
      'pending:agent:todo',
      'entry:agent:built-by-hand',
      'day:Aug 10',
      'step:agent:done',
      'entry:run:run-1',
    ]);
    expect(pending?.kind === 'row' ? pending.at : 'borrowed').toBeNull();
  });

  it('draws the day rule inside a run that crossed midnight and lets the lane pass through it', () => {
    const { items, groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 16, hour: 22, minute: 43 }) })],
      agents: [
        agent({
          id: 'before',
          ordinal: 1,
          startedAt: localIso({ day: 16, hour: 23, minute: 50 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'after',
          ordinal: 2,
          startedAt: localIso({ day: 17, hour: 0, minute: 8 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const layout = layoutTimelineRail({ rows: items, groups });
    const innerRule = items.findIndex((item) => item.kind === 'day' && item.label === 'Aug 16');

    expect(labelsOf(items)).toEqual([
      'now',
      'day:Yesterday',
      'step:agent:after',
      'day:Aug 16',
      'step:agent:before',
      'entry:run:run-1',
    ]);
    expect(layout.rows[innerRule]?.segments.filter((segment) => segment.column === 1)).toHaveLength(
      1,
    );
  });

  it('hangs a fan-out on a branch one column past the step it belongs to', () => {
    const { items, groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'implement',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'sub-a',
          ordinal: 2,
          parentAgentId: 'implement',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
        }),
      ],
    });
    const layout = layoutTimelineRail({ rows: items, groups });

    expect(labelsOf(items)).toEqual([
      'now',
      'step:agent:sub-a',
      'step:agent:implement',
      'entry:run:run-1',
    ]);
    expect(layout.columnByGroupId.get('lane:run:run-1')).toBe(1);
    expect(layout.columnByGroupId.get('lane:agent:implement')).toBe(2);
  });

  it('shows a finished step with its subagents folded into one count row above it', () => {
    const { items, groups } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['implement'] }),
      ],
      expanded: ['run:run-1'],
      folds: true,
      agents: [
        agent({
          id: 'implement',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'sub-a',
          ordinal: 2,
          parentAgentId: 'implement',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
        }),
      ],
    });
    const step = items.find((item) => item.id === 'agent:implement');
    const count = items.find((item) => item.id === 'count:subagents:agent:implement');

    expect(labelsOf(items)).toEqual([
      'now',
      'count:run:run-1',
      'count:subagents:agent:implement',
      'step:agent:implement',
      'entry:run:run-1',
    ]);
    expect(step?.kind === 'row' ? step.branches : null).toEqual([
      { expandId: 'subagents:agent:implement', isExpanded: false },
    ]);
    expect(count?.kind === 'count' ? count.summary.parts[0]?.count : null).toBe(1);
    expect(groups.map((group) => group.id)).toEqual(['lane:run:run-1', 'lane:agent:implement']);
  });

  it('seats a launch started during a run by its own time, between the steps', () => {
    const { items, groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'step-one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'loose', ordinal: 2, startedAt: localIso({ day: 18, hour: 9, minute: 30 }) }),
        agent({
          id: 'step-two',
          ordinal: 3,
          startedAt: localIso({ day: 18, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const layout = layoutTimelineRail({ rows: items, groups });
    const looseIndex = indexOfId({ items, id: 'agent:loose' });

    expect(labelsOf(items)).toEqual([
      'now',
      'step:agent:step-two',
      'entry:agent:loose',
      'step:agent:step-one',
      'entry:run:run-1',
    ]);
    expect(layout.rows[looseIndex]?.markerColumn).toBe(0);
    expect(layout.rows[looseIndex]?.segments.filter((segment) => segment.column > 0)).toHaveLength(
      1,
    );
  });

  it('keeps a chain above its parent when the children landed a day later', () => {
    const { items, groups } = stream({
      agents: [
        agent({
          id: 'cluster-parent',
          ordinal: 1,
          startedAt: localIso({ day: 17, hour: 21, minute: 35 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 40 }),
        }),
        agent({ id: 'elenca', ordinal: 2, startedAt: localIso({ day: 17, hour: 21, minute: 37 }) }),
        agent({
          id: 'cluster-child',
          ordinal: 3,
          parentAgentId: 'cluster-parent',
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
        }),
      ],
      events: [
        sessionEvent({
          id: 'ev-decision',
          kind: 'decisions_changed',
          at: localIso({ day: 17, hour: 23, minute: 27 }),
          payload: { added: 1 },
        }),
      ],
    });
    const layout = layoutTimelineRail({ rows: items, groups });
    const laneSegmentsOf = ({ id }: { readonly id: string }) =>
      layout.rows[indexOfId({ items, id })]?.segments.filter((segment) => segment.column > 0) ?? [];

    expect(labelsOf(items)).toEqual([
      'now',
      'step:agent:cluster-child',
      'day:Yesterday',
      'fact:event:ev-decision',
      'entry:agent:elenca',
      'entry:agent:cluster-parent',
    ]);
    expect(laneSegmentsOf({ id: 'event:ev-decision' })).toHaveLength(1);
    expect(laneSegmentsOf({ id: 'agent:elenca' })).toHaveLength(1);
    expect(laneSegmentsOf({ id: 'agent:cluster-child' })).toHaveLength(1);
  });

  it('centres a marker on its label line, not on a row box carrying leading air', () => {
    const withAir = markerCenterY({ grade: 'entry', gap: 'entry' });
    const boxCentre = (TIMELINE_RHYTHM.gap.entry + TIMELINE_RHYTHM.grade.entry.height) / 2;

    expect(withAir).toBe(TIMELINE_RHYTHM.gap.entry + TIMELINE_RHYTHM.grade.entry.height / 2);
    expect(withAir).not.toBe(boxCentre);
  });

  it('separates two launches more than two steps of one run', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'step-one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'step-two',
          ordinal: 2,
          startedAt: localIso({ day: 18, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
        agent({ id: 'loose', ordinal: 3, startedAt: localIso({ day: 18, hour: 11 }) }),
      ],
    });
    const gaps = items.flatMap((item) => (item.kind === 'row' ? [`${item.id}:${item.gap}`] : []));

    expect(gaps).toEqual([
      'agent:loose:none',
      'agent:step-two:entry',
      'agent:step-one:sibling',
      'run:run-1:sibling',
    ]);
  });

  describe('one time order down the whole feed', () => {
    const settled = ({
      id,
      ordinal,
      minute,
      workflowRunId,
      parentAgentId,
    }: {
      readonly id: string;
      readonly ordinal: number;
      readonly minute: number;
      readonly workflowRunId?: WorkflowRunId;
      readonly parentAgentId?: string;
    }): Agent =>
      agent({
        id,
        ordinal,
        startedAt: localIso({ day: 18, hour: 9, minute }),
        completedAt: localIso({ day: 18, hour: 9, minute: minute + 5 }),
        ...(workflowRunId === undefined ? {} : { workflowRunId }),
        ...(parentAgentId === undefined ? {} : { parentAgentId }),
      });
    const busy = {
      workflows: [
        attachedWorkflow({
          createdAt: localIso({ day: 18, hour: 8, minute: 50 }),
          stepIds: ['one', 'two', 'three'],
        }),
        attachedWorkflow({
          runId: OTHER_RUN_ID,
          name: 'Refactor workflow',
          createdAt: localIso({ day: 17, hour: 22 }),
          stepIds: ['old-step'],
        }),
      ],
      agents: [
        agent({
          id: 'old-step',
          ordinal: 1,
          startedAt: localIso({ day: 17, hour: 22, minute: 30 }),
          completedAt: localIso({ day: 17, hour: 23 }),
          workflowRunId: OTHER_RUN_ID,
        }),
        settled({ id: 'one', ordinal: 2, minute: 0, workflowRunId: RUN_ID }),
        settled({ id: 'one-a', ordinal: 3, minute: 2, parentAgentId: 'one' }),
        settled({ id: 'loose', ordinal: 4, minute: 12 }),
        settled({ id: 'two', ordinal: 5, minute: 20, workflowRunId: RUN_ID }),
        settled({ id: 'two-a', ordinal: 6, minute: 22, parentAgentId: 'two' }),
        settled({ id: 'two-b', ordinal: 7, minute: 24, parentAgentId: 'two' }),
        settled({ id: 'three', ordinal: 8, minute: 40, workflowRunId: RUN_ID }),
      ],
    };

    it('never lets a clock rise going down, through steps, subagents and foreign rows', () => {
      const { items } = stream(busy);
      const times = timesDownTheFeed(items);

      expect(times.length).toBeGreaterThan(8);
      expect(times).toEqual([...times].sort((first, second) => second.localeCompare(first)));
    });

    it('puts every child above its parent and every step above its run row', () => {
      const { items, groups } = stream(busy);

      for (const group of groups) {
        const originIndex = indexOfId({ items, id: group.originRowId });
        const members = items.flatMap((item, index) => (item.groupId === group.id ? [index] : []));

        expect(members.length).toBeGreaterThan(0);
        expect(members.every((index) => index < originIndex)).toBe(true);
      }
    });

    it('keeps the clocks falling when the run folds and its steps are shown again', () => {
      const folded = stream({ ...busy, folds: true });
      const opened = stream({
        ...busy,
        folds: true,
        expanded: ['run:run-1', 'run:run-2', 'subagents:agent:two', 'subagents:agent:one'],
      });

      for (const result of [folded, opened]) {
        const times = timesDownTheFeed(result.items);

        expect(times).toEqual([...times].sort((first, second) => second.localeCompare(first)));
      }
    });
  });

  describe('folding a finished branch into a count row', () => {
    const finishedRun = {
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 20 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          startedAt: localIso({ day: 18, hour: 10 }),
          completedAt: localIso({ day: 18, hour: 10, minute: 20 }),
          workflowRunId: RUN_ID,
        }),
      ],
    };
    const finishedRunWorkflows = [
      attachedWorkflow({
        createdAt: localIso({ day: 18, hour: 8 }),
        stepIds: ['one', 'two'],
      }),
    ];

    it('folds a finished run, whatever its size, to one count row above its run row', () => {
      const { items, groups } = stream({
        ...finishedRun,
        workflows: finishedRunWorkflows,
        folds: true,
      });
      const count = items.find((item) => item.kind === 'count');
      const layout = layoutTimelineRail({ rows: items, groups });
      const countIndex = items.findIndex((item) => item.kind === 'count');

      expect(labelsOf(items)).toEqual(['now', 'count:run:run-1', 'entry:run:run-1']);
      expect(count?.kind === 'count' ? count.isExpanded : null).toBe(false);
      expect(count?.kind === 'count' ? count.summary.parts[0]?.count : null).toBe(2);
      expect(layout.rows[countIndex]?.markerColumn).toBe(1);
      expect(layout.rows[countIndex]?.markerY).toBe(count?.markerY);
    });

    it('puts a day rule above a count row, never between the count row and its run row', () => {
      const { items } = stream({
        ...finishedRun,
        workflows: [
          attachedWorkflow({ createdAt: localIso({ day: 16, hour: 8 }), stepIds: ['one', 'two'] }),
        ],
        agents: [
          ...finishedRun.agents.map((entry) => ({
            ...entry,
            startedAt: typedString<IsoDateTime>({ value: localIso({ day: 16, hour: 9 }) }),
            completedAt: typedString<IsoDateTime>({ value: localIso({ day: 16, hour: 10 }) }),
          })),
          agent({ id: 'today', ordinal: 3, startedAt: localIso({ day: 18, hour: 9 }) }),
        ],
        folds: true,
      });

      expect(labelsOf(items)).toEqual([
        'now',
        'entry:agent:today',
        'day:Aug 16',
        'count:run:run-1',
        'entry:run:run-1',
      ]);
    });

    it('keeps the count row as the top cap of the lane once the run is open', () => {
      const { items } = stream({
        ...finishedRun,
        workflows: finishedRunWorkflows,
        folds: true,
        expanded: ['run:run-1'],
      });
      const count = items.find((item) => item.kind === 'count');

      expect(labelsOf(items)).toEqual([
        'now',
        'count:run:run-1',
        'step:agent:two',
        'step:agent:one',
        'entry:run:run-1',
      ]);
      expect(count?.kind === 'count' ? count.isExpanded : null).toBe(true);
    });

    it('gives a folded run row the keys to open its count row', () => {
      const { items } = stream({
        ...finishedRun,
        workflows: finishedRunWorkflows,
        folds: true,
      });
      const run = items.find((item) => item.id === 'run:run-1');

      expect(run?.kind === 'row' ? run.branches : null).toEqual([
        { expandId: 'run:run-1', isExpanded: false },
      ]);
    });

    it('never folds a live run and gives it no count row or fold key', () => {
      const { items } = stream({
        workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
        folds: true,
        agents: [
          agent({
            id: 'one',
            ordinal: 1,
            startedAt: localIso({ day: 18, hour: 9 }),
            completedAt: localIso({ day: 18, hour: 9, minute: 20 }),
            workflowRunId: RUN_ID,
          }),
          agent({
            id: 'two',
            ordinal: 2,
            status: 'running',
            startedAt: localIso({ day: 18, hour: 10 }),
            workflowRunId: RUN_ID,
          }),
        ],
      });
      const run = items.find((item) => item.id === 'run:run-1');

      expect(labelsOf(items)).toEqual([
        'now',
        'step:agent:two',
        'step:agent:one',
        'entry:run:run-1',
      ]);
      expect(items.some((item) => item.kind === 'count')).toBe(false);
      expect(run?.kind === 'row' ? run.branches : 'missing').toBeUndefined();
    });

    it('keeps the subagents of a running step shown, with no way to fold them', () => {
      const { items } = stream({
        workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
        folds: true,
        agents: [
          agent({
            id: 'step',
            ordinal: 1,
            status: 'running',
            startedAt: localIso({ day: 18, hour: 9 }),
            workflowRunId: RUN_ID,
          }),
          agent({
            id: 'child-a',
            ordinal: 2,
            parentAgentId: 'step',
            startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
            completedAt: localIso({ day: 18, hour: 9, minute: 20 }),
          }),
          agent({
            id: 'child-b',
            ordinal: 3,
            parentAgentId: 'step',
            status: 'running',
            startedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          }),
        ],
      });
      const step = items.find((item) => item.id === 'agent:step');

      expect(labelsOf(items)).toEqual([
        'now',
        'step:agent:child-b',
        'step:agent:child-a',
        'step:agent:step',
        'entry:run:run-1',
      ]);
      expect(items.some((item) => item.kind === 'count')).toBe(false);
      expect(step?.kind === 'row' ? step.branches : 'missing').toBeUndefined();
    });

    it('folds a finished step with two subagents, however few', () => {
      const { items } = stream({
        workflows: [
          attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['step'] }),
        ],
        folds: true,
        expanded: ['run:run-1'],
        agents: [
          agent({
            id: 'step',
            ordinal: 1,
            startedAt: localIso({ day: 18, hour: 9 }),
            workflowRunId: RUN_ID,
          }),
          agent({
            id: 'child-a',
            ordinal: 2,
            parentAgentId: 'step',
            startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
          }),
          agent({
            id: 'child-b',
            ordinal: 3,
            parentAgentId: 'step',
            startedAt: localIso({ day: 18, hour: 9, minute: 20 }),
          }),
        ],
      });
      const count = items.find((item) => item.id === 'count:subagents:agent:step');

      expect(labelsOf(items)).toEqual([
        'now',
        'count:run:run-1',
        'count:subagents:agent:step',
        'step:agent:step',
        'entry:run:run-1',
      ]);
      expect(count?.kind === 'count' ? count.summary.parts[0]?.count : null).toBe(2);
    });

    const stepWithChildren = ({
      failed,
    }: {
      readonly failed: Pick<Agent, 'status' | 'doneAt'>;
    }) => ({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['step'] }),
      ],
      folds: true,
      expanded: ['run:run-1'],
      agents: [
        agent({
          id: 'step',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'child-ok',
          ordinal: 2,
          parentAgentId: 'step',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
        }),
        agent({
          id: 'child-failed',
          ordinal: 3,
          parentAgentId: 'step',
          startedAt: localIso({ day: 18, hour: 9, minute: 20 }),
          status: failed.status,
          ...(failed.doneAt === undefined ? {} : { doneAt: failed.doneAt }),
        }),
      ],
    });

    it('keeps the branch open while a subagent has failed and nobody dealt with it', () => {
      const { items } = stream(stepWithChildren({ failed: { status: 'failed' } }));

      expect(items.some((item) => item.kind === 'count' && item.id.includes('subagents'))).toBe(
        false,
      );
      expect(labelsOf(items)).toContain('step:agent:child-failed');
    });

    it('counts a subagent that was closed beside the total once the branch settles', () => {
      const { items } = stream(
        stepWithChildren({
          failed: {
            status: 'failed',
            doneAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 25 }) }),
          },
        }),
      );
      const count = items.find((item) => item.id === 'count:subagents:agent:step');

      expect(
        count?.kind === 'count'
          ? count.summary.parts.map((part) => `${part.count} ${part.noun}`)
          : [],
      ).toEqual(['2 subagents', '1 closed']);
    });
  });
});

type SessionEventParams = {
  readonly id: string;
  readonly kind: SessionEventKind;
  readonly at: string;
  readonly payload?: SessionEventPayload;
};

const sessionEvent = ({ id, kind, at, payload }: SessionEventParams): SessionEvent => ({
  id: typedString<SessionEventId>({ value: id }),
  sessionId: SESSION_ID,
  kind,
  payload: payload ?? null,
  createdAt: typedString<IsoDateTime>({ value: at }),
});

describe('buildTimelineStream, session events', () => {
  describe('stopped rebases', () => {
    const stopped = ({
      id,
      minute,
      branch = 'feat/export',
      day = 18,
    }: {
      readonly id: string;
      readonly minute: number;
      readonly branch?: string;
      readonly day?: number;
    }) =>
      sessionEvent({
        id,
        kind: 'history_stopped',
        at: localIso({ day, hour: 9, minute }),
        payload: { branch, origin: 'rebase' },
      });
    const eventRows = (items: ReadonlyArray<TimelineStreamItem>) =>
      items.flatMap((item) =>
        item.kind === 'row' && item.entry.kind === 'event' ? [item.entry] : [],
      );

    it('merges consecutive stops of the same rebase into one row with its count', () => {
      const { items } = stream({
        agents: [],
        events: [
          stopped({ id: 'stop-1', minute: 1 }),
          stopped({ id: 'stop-2', minute: 2 }),
          stopped({ id: 'stop-3', minute: 3 }),
        ],
      });
      const [only, ...rest] = eventRows(items);

      expect(rest).toEqual([]);
      expect(only?.repeatCount).toBe(3);
      expect(only?.event.id).toBe('stop-3');
    });

    it('keeps a single stop as it is', () => {
      const { items } = stream({ agents: [], events: [stopped({ id: 'stop-1', minute: 1 })] });

      expect(eventRows(items).map((entry) => entry.repeatCount)).toEqual([undefined]);
    });

    it('keeps stops of two branches on separate rows', () => {
      const { items } = stream({
        agents: [],
        events: [
          stopped({ id: 'stop-1', minute: 1 }),
          stopped({ id: 'stop-2', minute: 2, branch: 'fix/webhook' }),
        ],
      });

      expect(eventRows(items)).toHaveLength(2);
    });

    it('breaks the run when another row lands between two stops or a day passes', () => {
      const between = stream({
        agents: [],
        events: [
          stopped({ id: 'stop-1', minute: 1 }),
          sessionEvent({
            id: 'branch',
            kind: 'branch_created',
            at: localIso({ day: 18, hour: 9, minute: 2 }),
            payload: { branch: 'fix/webhook' },
          }),
          stopped({ id: 'stop-2', minute: 3 }),
        ],
      });
      const acrossDays = stream({
        agents: [],
        events: [stopped({ id: 'old', minute: 1, day: 17 }), stopped({ id: 'new', minute: 2 })],
      });

      expect(eventRows(between.items).map((entry) => entry.repeatCount)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(eventRows(acrossDays.items)).toHaveLength(2);
    });
  });

  it('leaves out a decision change that added and removed nothing', () => {
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-empty',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 12 }),
          payload: { added: 0, removed: 0 },
        }),
      ],
    });

    expect(result.items.some((item) => item.id.includes('ev-empty'))).toBe(false);
  });

  it('merges three consecutive decision changes into the newest row', () => {
    const newestAt = localIso({ day: 18, hour: 12 });
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-oldest',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 10 }),
          payload: { added: 1, removed: 2 },
        }),
        sessionEvent({
          id: 'ev-middle',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 11 }),
          payload: { added: 3, removed: 1 },
        }),
        sessionEvent({
          id: 'ev-newest',
          kind: 'decisions_changed',
          at: newestAt,
          payload: { added: 2, removed: 4 },
        }),
      ],
    });
    const rows = result.items.flatMap((item) => (item.kind === 'row' ? [item] : []));
    const row = rows[0];

    expect(rows).toHaveLength(1);
    expect(row?.at).toBe(newestAt);
    expect(row?.entry.kind === 'event' ? row.entry.event.payload : null).toEqual({
      added: 6,
      removed: 7,
    });
  });

  it('adds up ledger changes and keeps a consolidation on its own row', () => {
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-first',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 10 }),
          payload: {
            added: 1,
            replaced: 0,
            withdrawn: 0,
            merged: 0,
            restored: 0,
            decisionChanges: [{ kind: 'added', number: 3, text: 'Key on the event id' }],
          },
        }),
        sessionEvent({
          id: 'ev-second',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 11 }),
          payload: {
            added: 0,
            replaced: 1,
            withdrawn: 0,
            merged: 0,
            restored: 0,
            decisionChanges: [
              { kind: 'replaced', number: 1, by: 4, text: 'Third retry', reason: null },
            ],
          },
        }),
        sessionEvent({
          id: 'ev-consolidated',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 12 }),
          payload: {
            added: 0,
            replaced: 0,
            withdrawn: 0,
            merged: 2,
            restored: 0,
            consolidatedAfter: 'the run finished',
          },
        }),
      ],
    });
    const payloads = result.items.flatMap((item) =>
      item.kind === 'row' && item.entry.kind === 'event' ? [item.entry.event.payload] : [],
    );

    expect(payloads).toHaveLength(2);
    expect(payloads).toContainEqual(
      expect.objectContaining({ added: 1, replaced: 1, withdrawn: 0, merged: 0 }),
    );
    expect(payloads).toContainEqual(
      expect.objectContaining({ consolidatedAfter: 'the run finished', merged: 2 }),
    );
  });

  it('keeps decision runs separate across a day boundary', () => {
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-yesterday',
          kind: 'decisions_changed',
          at: localIso({ day: 17, hour: 23 }),
          payload: { added: 1, removed: 0 },
        }),
        sessionEvent({
          id: 'ev-today',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 1 }),
          payload: { added: 2, removed: 1 },
        }),
      ],
    });
    const rows = result.items.flatMap((item) => (item.kind === 'row' ? [item] : []));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.entry.kind === 'event' ? rows[0].entry.event.payload : null).toEqual({
      added: 2,
      removed: 1,
    });
    expect(rows[1]?.entry.kind === 'event' ? rows[1].entry.event.payload : null).toEqual({
      added: 1,
      removed: 0,
    });
  });

  it('keeps decision runs separate across an agent row', () => {
    const result = stream({
      agents: [
        agent({ id: 'interleaved', ordinal: 1, startedAt: localIso({ day: 18, hour: 11 }) }),
      ],
      events: [
        sessionEvent({
          id: 'ev-oldest',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 9 }),
          payload: { added: 1, removed: 0 },
        }),
        sessionEvent({
          id: 'ev-older',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 10 }),
          payload: { added: 2, removed: 1 },
        }),
        sessionEvent({
          id: 'ev-newer',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 12 }),
          payload: { added: 3, removed: 2 },
        }),
        sessionEvent({
          id: 'ev-newest',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 13 }),
          payload: { added: 4, removed: 3 },
        }),
      ],
    });
    const rows = result.items.flatMap((item) => (item.kind === 'row' ? [item] : []));
    const payloads = rows.flatMap((row) =>
      row.entry.kind === 'event' ? [row.entry.event.payload] : [],
    );

    expect(rows.map((row) => row.id)).toEqual([
      'event:ev-newest',
      'agent:interleaved',
      'event:ev-older',
    ]);
    expect(payloads).toEqual([
      { added: 7, removed: 5 },
      { added: 3, removed: 1 },
    ]);
  });

  it('leaves a single decision change unchanged', () => {
    const payload = { added: 1, removed: 2 };
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-only',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 12 }),
          payload,
        }),
      ],
    });
    const row = result.items.find((item) => item.kind === 'row');

    expect(row?.entry.kind === 'event' ? row.entry.event.payload : null).toBe(payload);
  });

  it('keeps the newest decision row id after merging', () => {
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-older',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 11 }),
          payload: { added: 1, removed: 0 },
        }),
        sessionEvent({
          id: 'ev-newest',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 12 }),
          payload: { added: 1, removed: 0 },
        }),
      ],
    });
    const rows = result.items.flatMap((item) => (item.kind === 'row' ? [item] : []));

    expect(rows.map((row) => row.id)).toEqual(['event:ev-newest']);
  });

  it('keeps the worktree row at the bottom when creation events share an instant', () => {
    const at = localIso({ day: 18, hour: 8 });
    const result = stream({
      agents: [],
      events: [
        sessionEvent({ id: 'ev-branch', kind: 'branch_created', at }),
        sessionEvent({ id: 'ev-worktree', kind: 'worktree_created', at }),
      ],
    });
    const rows = result.items.flatMap((item) => (item.kind === 'row' ? [item.id] : []));

    expect(rows).toEqual(['event:ev-branch', 'event:ev-worktree']);
  });

  it('orders the rest of the trace newest first', () => {
    const result = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-worktree',
          kind: 'worktree_created',
          at: localIso({ day: 18, hour: 8 }),
        }),
        sessionEvent({ id: 'ev-merge', kind: 'pr_merged', at: localIso({ day: 18, hour: 12 }) }),
      ],
    });
    const rows = result.items.flatMap((item) => (item.kind === 'row' ? [item.id] : []));

    expect(rows).toEqual(['event:ev-merge', 'event:ev-worktree']);
  });

  it('recedes the lane of a discarded run together with the lanes of its children', () => {
    const attached = attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) });
    const { groups } = stream({
      expanded: ['subagents:agent:implement'],
      workflows: [
        {
          ...attached,
          run: {
            ...attached.run,
            discardedAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 11 }) }),
          },
        },
      ],
      agents: [
        agent({
          id: 'implement',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'sub-a',
          ordinal: 2,
          parentAgentId: 'implement',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
        }),
      ],
    });

    expect(groups.map((group) => group.id)).toEqual(['lane:run:run-1', 'lane:agent:implement']);
    expect(groups.every((group) => group.isMuted)).toBe(true);
    expect(new Set(groups.map((group) => group.identityIndex)).size).toBe(1);
  });

  it('leaves the lanes of a live run at full presence', () => {
    const { groups } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'implement',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'sub-a',
          ordinal: 2,
          parentAgentId: 'implement',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
        }),
      ],
    });

    expect(groups.some((group) => group.isMuted)).toBe(false);
  });

  it('marks a run whose orchestrator is choosing the next step as deciding, not pending', () => {
    const settledSteps = {
      workflows: [
        attachedWorkflow({
          createdAt: localIso({ day: 18, hour: 8 }),
          stepIds: ['one'],
          executionMode: 'dynamic',
        }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
      ],
    };
    const idle = stream(settledSteps);
    const deciding = stream({ ...settledSteps, decidingRunIds: new Set([RUN_ID]) });
    const idleRow = idle.items.find((item) => item.id === 'run:run-1');
    const decidingRow = deciding.items.find((item) => item.id === 'run:run-1');

    expect(stateOf(idleRow)).toBe('queued');
    expect(stateOf(decidingRow)).toBe('running:deciding');
  });

  it('keeps a run with a step in flight on running even while a decision is in flight', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({
          createdAt: localIso({ day: 18, hour: 8 }),
          stepIds: ['one'],
          executionMode: 'dynamic',
        }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
      decidingRunIds: new Set([RUN_ID]),
    });
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(stateOf(runRow)).toBe('running');
  });

  it('closes the lane of a dynamic run once the orchestrator declares it done', () => {
    const { items, groups } = stream({
      workflows: [
        attachedWorkflow({
          createdAt: localIso({ day: 18, hour: 8 }),
          stepIds: ['one', 'two'],
          executionMode: 'dynamic',
          orchestrationOutcome: 'done',
        }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          startedAt: localIso({ day: 18, hour: 10 }),
          completedAt: localIso({ day: 18, hour: 10, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const lane = groups.find((group) => group.id === 'lane:run:run-1');
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(lane?.shape).toBe('merged');
    expect(stateOf(runRow)).toBe('done');
  });

  it('closes the lane of a static run when every planned step has settled', () => {
    const { groups } = stream({
      workflows: [
        attachedWorkflow({
          createdAt: localIso({ day: 18, hour: 8 }),
          stepIds: ['one', 'two'],
        }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          startedAt: localIso({ day: 18, hour: 10 }),
          completedAt: localIso({ day: 18, hour: 10, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const lane = groups.find((group) => group.id === 'lane:run:run-1');

    expect(lane?.shape).toBe('merged');
  });

  it('gives a chained agent group a colored lane', () => {
    const result = stream({
      expanded: ['subagents:agent:planner'],
      agents: [
        agent({ id: 'planner', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) }),
        agent({
          id: 'implementer',
          ordinal: 1,
          parentAgentId: 'planner',
          startedAt: localIso({ day: 18, hour: 10 }),
        }),
      ],
    });

    expect(result.groups.map((group) => group.identityIndex)).toEqual([expect.any(Number)]);
  });
});

describe('buildTimelineStream, subagent collapse', () => {
  const FAN_OUT: ReadonlyArray<Agent> = [
    agent({
      id: 'implement',
      ordinal: 1,
      startedAt: localIso({ day: 18, hour: 9 }),
      workflowRunId: RUN_ID,
    }),
    agent({
      id: 'sub-a',
      ordinal: 2,
      parentAgentId: 'implement',
      startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
    }),
    agent({
      id: 'sub-a-a',
      ordinal: 3,
      parentAgentId: 'sub-a',
      startedAt: localIso({ day: 18, hour: 9, minute: 20 }),
    }),
    agent({ id: 'cluster-parent', ordinal: 4, startedAt: localIso({ day: 18, hour: 10 }) }),
    agent({
      id: 'cluster-child',
      ordinal: 5,
      parentAgentId: 'cluster-parent',
      startedAt: localIso({ day: 18, hour: 10, minute: 10 }),
    }),
  ];

  const FAN_OUT_WORKFLOWS = [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })];

  it('folds the descendants of a finished step until its count row opens them', () => {
    const closed = stream({ workflows: FAN_OUT_WORKFLOWS, agents: FAN_OUT, folds: true });
    const open = stream({
      workflows: FAN_OUT_WORKFLOWS,
      agents: FAN_OUT,
      folds: true,
      expanded: ['subagents:agent:implement', 'subagents:agent:sub-a'],
    });

    expect(closed.items.map(labelOf)).toEqual([
      'now',
      'count:subagents:agent:cluster-parent',
      'entry:agent:cluster-parent',
      'count:subagents:agent:implement',
      'step:agent:implement',
      'entry:run:run-1',
    ]);
    expect(open.items.map(labelOf)).toEqual([
      'now',
      'count:subagents:agent:cluster-parent',
      'entry:agent:cluster-parent',
      'count:subagents:agent:implement',
      'count:subagents:agent:sub-a',
      'step:agent:sub-a-a',
      'step:agent:sub-a',
      'step:agent:implement',
      'entry:run:run-1',
    ]);
    expect(open.items.map((item) => (item.kind === 'row' ? item.ordinal : null))).toEqual([
      null,
      null,
      null,
      null,
      null,
      '1.1.1',
      '1.1',
      '1',
      null,
    ]);
  });

  it('keeps the lane of a folded brood, carrying only its count row', () => {
    const { items, groups } = stream({
      workflows: FAN_OUT_WORKFLOWS,
      agents: FAN_OUT,
      folds: true,
    });
    const layout = layoutTimelineRail({ rows: items, groups });

    expect(groups.map((group) => group.id).sort()).toEqual([
      'lane:agent:cluster-parent',
      'lane:agent:implement',
      'lane:run:run-1',
    ]);
    for (const group of groups) {
      expect(items.some((item) => item.groupId === group.id)).toBe(true);
    }
    expect(layout.columnByGroupId.get('lane:run:run-1')).toBe(1);
    expect(layout.columnByGroupId.get('lane:agent:implement')).toBe(2);
    expect(layout.columnByGroupId.get('lane:agent:cluster-parent')).toBe(2);
  });

  it('moves a hidden child unread onto the parent row', () => {
    const collapsed = stream({
      workflows: FAN_OUT_WORKFLOWS,
      agents: FAN_OUT,
      folds: true,
      unreadAgentIds: new Set(['sub-a-a', 'cluster-child']),
    });
    const unreadIds = collapsed.items.flatMap((item) =>
      item.kind === 'row' && item.hasUnread ? [item.id] : [],
    );

    expect(unreadIds).toEqual(expect.arrayContaining(['agent:implement', 'agent:cluster-parent']));
  });

  it('moves a hidden child unread onto the folded step row', () => {
    const closed = stream({
      workflows: FAN_OUT_WORKFLOWS,
      agents: FAN_OUT,
      folds: true,
      unreadAgentIds: new Set(['sub-a-a']),
    });
    const unreadIds = closed.items.flatMap((item) =>
      item.kind === 'row' && item.hasUnread ? [item.id] : [],
    );

    expect(unreadIds).toEqual(['agent:implement']);
  });

  it('leaves the unread on the child row itself while subagents are shown', () => {
    const expanded = stream({
      workflows: FAN_OUT_WORKFLOWS,
      agents: FAN_OUT,
      folds: true,
      unreadAgentIds: new Set(['sub-a-a']),
      expanded: ['subagents:agent:implement', 'subagents:agent:sub-a'],
    });
    const unreadIds = expanded.items.flatMap((item) =>
      item.kind === 'row' && item.hasUnread ? [item.id] : [],
    );

    expect(unreadIds).toEqual(['agent:sub-a-a']);
  });
});

describe('buildTimelineStream, plan visibility and family anchoring', () => {
  const runPlan: PlanWithCount = {
    id: typedString<PlanId>({ value: 'plan-1' }),
    sessionId: SESSION_ID,
    agentId: typedString<AgentId>({ value: 'plan' }),
    workflowRunId: RUN_ID,
    title: 'migration plan',
    bodyMd: '',
    status: 'active',
    createdAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 15 }) }),
    updatedAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 15 }) }),
    consumptionCount: 0,
  };

  const PLAN_RUN_AGENTS: ReadonlyArray<Agent> = [
    agent({
      id: 'plan',
      ordinal: 1,
      startedAt: localIso({ day: 18, hour: 9 }),
      completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
      workflowRunId: RUN_ID,
    }),
  ];

  const PLAN_RUN_WORKFLOWS = [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })];

  type StandalonePlanParams = {
    readonly id: string;
    readonly agentId: string;
  };

  const standalonePlan = ({ id, agentId }: StandalonePlanParams): PlanWithCount => ({
    id: typedString<PlanId>({ value: id }),
    sessionId: SESSION_ID,
    agentId: typedString<AgentId>({ value: agentId }),
    title: id,
    bodyMd: '',
    status: 'active',
    createdAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 15 }) }),
    updatedAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 15 }) }),
    consumptionCount: 0,
  });

  it('joins plans authored by a chain root and child to the root lane', () => {
    const { items } = stream({
      agents: [
        agent({ id: 'planner', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) }),
        agent({
          id: 'implementer',
          ordinal: 1,
          parentAgentId: 'planner',
          startedAt: localIso({ day: 18, hour: 10 }),
        }),
      ],
      plans: [
        standalonePlan({ id: 'root-plan', agentId: 'planner' }),
        standalonePlan({ id: 'child-plan', agentId: 'implementer' }),
      ],
    });
    const root = items.find((item) => item.kind === 'row' && item.id === 'agent:planner');
    const planRows = items.filter(
      (item) =>
        item.kind === 'row' && (item.id === 'plan:root-plan' || item.id === 'plan:child-plan'),
    );

    expect(planRows.map((item) => item.groupId)).toEqual([
      'lane:agent:planner',
      'lane:agent:planner',
    ]);
    expect(planRows.map((item) => (item.kind === 'row' ? item.identity : null))).toEqual([
      root?.kind === 'row' ? root.identity : null,
      root?.kind === 'row' ? root.identity : null,
    ]);
  });

  it('folds a plan authored outside a chain into the outputs of its launch', () => {
    const params = {
      agents: [agent({ id: 'solo', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) })],
      plans: [standalonePlan({ id: 'solo-plan', agentId: 'solo' })],
      folds: true,
    };
    const closed = stream(params);
    const open = stream({ ...params, expanded: ['outputs:agent:solo'] });
    const launch = closed.items.find((item) => item.kind === 'row' && item.id === 'agent:solo');
    const planRow = open.items.find((item) => item.kind === 'row' && item.id === 'plan:solo-plan');

    expect(closed.items.map(labelOf)).toEqual([
      'now',
      'count:outputs:agent:solo',
      'entry:agent:solo',
    ]);
    expect(launch?.kind === 'row' ? launch.branches : null).toEqual([
      { expandId: 'outputs:agent:solo', isExpanded: false },
    ]);
    expect(open.items.map(labelOf)).toEqual([
      'now',
      'count:outputs:agent:solo',
      'step:plan:solo-plan',
      'entry:agent:solo',
    ]);
    expect(planRow?.groupId).toBe('outputs-lane:agent:solo');
  });

  it('keeps the outputs of a running launch shown, with no count row', () => {
    const { items } = stream({
      agents: [
        agent({
          id: 'solo',
          ordinal: 0,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
        }),
      ],
      plans: [standalonePlan({ id: 'solo-plan', agentId: 'solo' })],
      folds: true,
    });

    expect(items.map(labelOf)).toEqual(['now', 'step:plan:solo-plan', 'entry:agent:solo']);
  });

  it('counts every kind of output on the launch and keeps the ones of other launches apart', () => {
    const { items } = stream({
      folds: true,
      agents: [
        agent({ id: 'solo', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) }),
        agent({ id: 'other', ordinal: 1, startedAt: localIso({ day: 18, hour: 10 }) }),
      ],
      plans: [
        standalonePlan({ id: 'plan-a', agentId: 'solo' }),
        standalonePlan({ id: 'plan-b', agentId: 'other' }),
      ],
      artifacts: [
        {
          ...runReport,
          id: typedString<ArtifactId>({ value: 'report-solo' }),
          agentId: typedString<AgentId>({ value: 'solo' }),
          workflowRunId: null,
        },
      ],
    });
    const countOf = (expandId: string) => {
      const row = items.find((item) => item.kind === 'count' && item.expandId === expandId);
      return row?.kind === 'count' ? row.summary.total : undefined;
    };

    expect(countOf('outputs:agent:solo')).toBe(2);
    expect(countOf('outputs:agent:other')).toBe(1);
  });

  it('keeps the outputs of a closed chain in its lane instead of dropping them outside any group', () => {
    const agents = [
      agent({ id: 'planner', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) }),
      agent({
        id: 'implementer',
        ordinal: 1,
        parentAgentId: 'planner',
        startedAt: localIso({ day: 18, hour: 10 }),
      }),
    ];
    const plans = [standalonePlan({ id: 'root-plan', agentId: 'planner' })];
    const closed = stream({ agents, plans, folds: true });
    const open = stream({ agents, plans, folds: true, expanded: ['subagents:agent:planner'] });
    const groupIds = new Set(open.groups.map((group) => group.id));

    expect(closed.items.map(labelOf)).toEqual([
      'now',
      'count:subagents:agent:planner',
      'entry:agent:planner',
    ]);
    expect(open.items.map(labelOf)).toEqual([
      'now',
      'count:subagents:agent:planner',
      'step:agent:implementer',
      'step:plan:root-plan',
      'entry:agent:planner',
    ]);
    for (const item of open.items) {
      expect(item.groupId === null || groupIds.has(item.groupId)).toBe(true);
    }
  });

  it('keeps a run plan in the stream by default', () => {
    const { items } = stream({
      workflows: PLAN_RUN_WORKFLOWS,
      agents: PLAN_RUN_AGENTS,
      plans: [runPlan],
    });

    expect(items.map(labelOf)).toContain('step:plan:plan-1');
  });

  const runReport = {
    id: 'report-1',
    sessionId: SESSION_ID,
    agentId: typedString<AgentId>({ value: 'plan' }),
    workflowRunId: RUN_ID,
    kind: 'report',
    schemaVersion: 1,
    title: 'migration report',
    sourceFormat: 'markdown',
    sourceText: '',
    metadata: { reportType: 'session' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 30 }) }),
    updatedAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 30 }) }),
  } as unknown as SessionArtifact;

  const reportAgentOf = ({ status }: { readonly status: Agent['status'] }): Agent => ({
    ...agent({
      id: 'weekly-report',
      ordinal: 0,
      startedAt: localIso({ day: 18, hour: 9 }),
      completedAt: localIso({ day: 18, hour: 9, minute: 20 }),
      status,
    }),
    kind: 'report',
  });

  const reportRowOf = (items: ReadonlyArray<TimelineStreamItem>) =>
    items.find((item) => item.kind === 'row' && item.id === 'agent:weekly-report');

  it('shows a blocked report agent without an artifact as no artifact, never done', () => {
    const { items } = stream({ agents: [reportAgentOf({ status: 'blocked' })] });
    const row = reportRowOf(items);

    expect(stateOf(row)).toBe('waiting:noArtifact');
    if (row?.kind !== 'row') return;
    expect(rowStateNode({ state: row.rowState })).toEqual({
      state: 'approval',
      label: 'No artifact',
    });
    expect(rowStateTone({ state: row.rowState })).toBe('warning');
  });

  it('shows a report agent whose artifact was captured as done', () => {
    const { items } = stream({
      agents: [reportAgentOf({ status: 'completed' })],
      artifacts: [
        {
          ...runReport,
          agentId: typedString<AgentId>({ value: 'weekly-report' }),
        } as SessionArtifact,
      ],
    });

    expect(stateOf(reportRowOf(items))).toBe('done');
  });

  it('keeps a run report in the stream by default', () => {
    const { items } = stream({
      workflows: PLAN_RUN_WORKFLOWS,
      agents: PLAN_RUN_AGENTS,
      artifacts: [runReport],
    });

    expect(items.map(labelOf)).toContain('step:artifact:report-1');
  });

  const answeredQuestion: OpenQuestion = {
    id: typedString<OpenQuestionId>({ value: 'question-1' }),
    sessionId: SESSION_ID,
    createdByAgentId: typedString<AgentId>({ value: 'asker' }),
    text: 'Which auth flow should the migration keep?',
    suggestedAnswers: [],
    isBlocking: false,
    userAnswer: 'the oauth one',
    status: 'answered',
    createdAt: localIso({ day: 18, hour: 9 }) as IsoDateTime,
    answeredAt: localIso({ day: 18, hour: 10 }) as IsoDateTime,
  };

  const ASKER_AGENTS: ReadonlyArray<Agent> = [
    agent({
      id: 'asker',
      ordinal: 1,
      startedAt: localIso({ day: 18, hour: 8 }),
      completedAt: localIso({ day: 18, hour: 11 }),
    }),
  ];

  it('keeps an answered question in the stream by default, as a compact fact row', () => {
    const { items } = stream({ agents: ASKER_AGENTS, questions: [answeredQuestion] });

    expect(items.map(labelOf)).toContain('fact:question:question-1');
  });

  it('weighs a context row, an answered question and a lone plan the same, and a lane plan as a step', () => {
    const { items } = stream({
      workflows: PLAN_RUN_WORKFLOWS,
      agents: [...PLAN_RUN_AGENTS, ...ASKER_AGENTS],
      plans: [runPlan, { ...standalonePlan({ id: 'lone-plan', agentId: 'gone' }) }],
      questions: [answeredQuestion],
      events: [
        sessionEvent({
          id: 'ev-context',
          kind: 'decisions_changed',
          at: localIso({ day: 18, hour: 11, minute: 30 }),
          payload: { added: 1, replaced: 2 },
        }),
      ],
    });
    const rowOf = (id: string) =>
      items.find((item): item is TimelineRowItem => item.kind === 'row' && item.id === id);
    const facts = ['event:ev-context', 'question:question-1', 'plan:lone-plan'].map(rowOf);

    expect(facts.map((row) => row?.grade)).toEqual(['fact', 'fact', 'fact']);
    const boxBelowMarker = (row: TimelineRowItem | undefined) =>
      (row?.height ?? 0) - (row?.markerY ?? 0);
    expect(new Set(facts.map(boxBelowMarker)).size).toBe(1);
    expect(facts.every((row) => (row?.height ?? 0) <= 36)).toBe(true);
    expect(boxBelowMarker(facts[0])).toBeLessThan(boxBelowMarker(rowOf('agent:asker')));
    expect(rowOf('plan:plan-1')?.grade).toBe('step');
  });

  it('drops answered questions from the stream when questions are hidden', () => {
    const { items } = stream({
      agents: ASKER_AGENTS,
      questions: [answeredQuestion],
      showQuestions: false,
    });

    expect(items.map(labelOf)).not.toContain('fact:question:question-1');
    expect(items.map(labelOf)).toContain('entry:agent:asker');
  });

  const CLUSTER_RUN_AGENTS: ReadonlyArray<Agent> = [
    agent({
      id: 'implement',
      ordinal: 1,
      status: 'pending',
      startedAt: localIso({ day: 18, hour: 9 }),
      workflowRunId: RUN_ID,
    }),
    agent({
      id: 'sub-1',
      ordinal: 2,
      parentAgentId: 'implement',
      startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
    }),
    agent({ id: 'sub-3', ordinal: 4, status: 'pending', parentAgentId: 'implement' }),
    agent({ id: 'review', ordinal: 5, status: 'pending', workflowRunId: RUN_ID }),
  ];

  it('keeps every waiting family row at the top, with a started child still above its parent', () => {
    const { items } = stream({
      workflows: PLAN_RUN_WORKFLOWS,
      agents: CLUSTER_RUN_AGENTS,
    });

    expect(items.map(labelOf)).toEqual([
      'now',
      'pending:agent:review',
      'pending:agent:sub-3',
      'step:agent:sub-1',
      'pending:agent:implement',
      'entry:run:run-1',
    ]);
  });

  it('gives an anchored pending subagent no clock of its own', () => {
    const { items } = stream({
      workflows: PLAN_RUN_WORKFLOWS,
      agents: CLUSTER_RUN_AGENTS,
      expanded: ['subagents:agent:implement'],
    });
    const pendingChild = items.find((item) => item.id === 'agent:sub-3');

    expect(pendingChild?.kind === 'row' ? pendingChild.at : 'missing').toBeNull();
  });
});

describe('buildTimelineStream, question artifact rows', () => {
  type QuestionFixtureParams = {
    readonly id: string;
    readonly createdByAgentId?: string;
    readonly createdAt: string;
  };

  const openQuestionFor = ({
    id,
    createdByAgentId,
    createdAt,
  }: QuestionFixtureParams): OpenQuestion => ({
    id: typedString<OpenQuestionId>({ value: id }),
    sessionId: SESSION_ID,
    ...(createdByAgentId != null
      ? { createdByAgentId: typedString<AgentId>({ value: createdByAgentId }) }
      : {}),
    text: id,
    suggestedAnswers: [],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdAt: typedString<IsoDateTime>({ value: createdAt }),
  });

  const answeredQuestionFor = ({
    id,
    createdByAgentId,
    createdAt,
    answeredAt,
  }: QuestionFixtureParams & { readonly answeredAt: string }): OpenQuestion => ({
    ...openQuestionFor({ id, createdByAgentId, createdAt }),
    status: 'answered',
    userAnswer: 'yes',
    answeredAt: typedString<IsoDateTime>({ value: answeredAt }),
  });

  const CHAIN_AGENTS: ReadonlyArray<Agent> = [
    agent({ id: 'planner', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) }),
    agent({
      id: 'implementer',
      ordinal: 1,
      parentAgentId: 'planner',
      startedAt: localIso({ day: 18, hour: 10 }),
    }),
  ];

  it('lands a chain-root-authored question in the root lane, same as a plan artifact', () => {
    const { items } = stream({
      agents: CHAIN_AGENTS,
      questions: [
        openQuestionFor({
          id: 'root-question',
          createdByAgentId: 'planner',
          createdAt: localIso({ day: 18, hour: 11 }),
        }),
      ],
    });
    const root = items.find((item) => item.kind === 'row' && item.id === 'agent:planner');
    const questionRow = items.find(
      (item) => item.kind === 'row' && item.id === 'question:root-question',
    );

    expect(questionRow?.groupId).toBe('lane:agent:planner');
    expect(questionRow?.kind === 'row' ? questionRow.identity : null).toEqual(
      root?.kind === 'row' ? root.identity : null,
    );
  });

  it('bubbles a question authored by a descendant up to the chain root lane', () => {
    const { items } = stream({
      agents: CHAIN_AGENTS,
      questions: [
        openQuestionFor({
          id: 'child-question',
          createdByAgentId: 'implementer',
          createdAt: localIso({ day: 18, hour: 11 }),
        }),
      ],
    });
    const questionRow = items.find(
      (item) => item.kind === 'row' && item.id === 'question:child-question',
    );

    expect(questionRow?.groupId).toBe('lane:agent:planner');
  });

  it('lands a run-step-authored question in the run lane', () => {
    const { items } = stream({
      workflows: [attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) })],
      agents: [
        agent({
          id: 'implement',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
      questions: [
        answeredQuestionFor({
          id: 'run-question',
          createdByAgentId: 'implement',
          createdAt: localIso({ day: 18, hour: 9, minute: 30 }),
          answeredAt: localIso({ day: 18, hour: 9, minute: 45 }),
        }),
      ],
    });
    const run = items.find((item) => item.kind === 'row' && item.id === 'run:run-1');
    const questionRow = items.find(
      (item) => item.kind === 'row' && item.id === 'question:run-question',
    );

    expect(questionRow?.groupId).toBe('lane:run:run-1');
    expect(questionRow?.kind === 'row' ? questionRow.identity : null).toEqual(
      run?.kind === 'row' ? run.identity : null,
    );
  });

  it('keeps a question with no resolvable author on the spine', () => {
    const { items } = stream({
      agents: [agent({ id: 'unrelated', ordinal: 0, startedAt: localIso({ day: 18, hour: 9 }) })],
      questions: [
        openQuestionFor({ id: 'orphan-question', createdAt: localIso({ day: 18, hour: 11 }) }),
      ],
    });
    const questionRow = items.find(
      (item) => item.kind === 'row' && item.id === 'question:orphan-question',
    );

    expect(questionRow?.groupId).toBeNull();
    expect(questionRow?.kind === 'row' ? questionRow.identity : 'missing').toBeNull();
  });

  it('keeps every lane question on its own row, newest first', () => {
    const { items } = stream({
      agents: CHAIN_AGENTS,
      questions: [
        openQuestionFor({
          id: 'first-question',
          createdByAgentId: 'planner',
          createdAt: localIso({ day: 18, hour: 11 }),
        }),
        openQuestionFor({
          id: 'second-question',
          createdByAgentId: 'planner',
          createdAt: localIso({ day: 18, hour: 11, minute: 30 }),
        }),
      ],
    });

    expect(
      items.flatMap((item) =>
        item.kind === 'row' && item.entry.kind === 'question' ? [item.id] : [],
      ),
    ).toEqual(['question:second-question', 'question:first-question']);
  });

  it('keeps the run row quiet while the step that asks shows the question', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({
          createdAt: localIso({ day: 18, hour: 8 }),
          stepIds: ['one', 'two'],
          executionMode: 'dynamic',
        }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'two',
          ordinal: 2,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 10 }),
          workflowRunId: RUN_ID,
        }),
      ],
      questions: [
        openQuestionFor({
          id: 'step-question',
          createdByAgentId: 'two',
          createdAt: localIso({ day: 18, hour: 10, minute: 5 }),
        }),
      ],
      decidingRunIds: new Set([RUN_ID]),
    });
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(stateOf(runRow)).toBe('waiting:stepAsking');
    expect(runRow?.kind === 'row' ? runRow.rowState.ask : undefined).toBeNull();
  });

  it('keeps the run row quiet when a hidden subagent asks but its question row shows', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one'] }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
        agent({
          id: 'child',
          ordinal: 2,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
          workflowRunId: RUN_ID,
          parentAgentId: 'one',
        }),
      ],
      questions: [
        openQuestionFor({
          id: 'nested-question',
          createdByAgentId: 'child',
          createdAt: localIso({ day: 18, hour: 9, minute: 20 }),
        }),
      ],
    });
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(stateOf(runRow)).toBe('waiting:stepAsking');
  });

  it('offers one Answer for a one-step workflow question, on the question row', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one'] }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
      ],
      questions: [
        openQuestionFor({
          id: 'only-question',
          createdByAgentId: 'one',
          createdAt: localIso({ day: 18, hour: 9, minute: 30 }),
        }),
      ],
    });
    const asks = items.flatMap((item) =>
      item.kind === 'row' && item.rowState.ask?.kind === 'answer' ? [item.entry.kind] : [],
    );

    expect(asks).toEqual(['question']);
  });

  it('puts the one Restart on the failed step row, never on the run row', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one', 'two'] }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'failed',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const asks = items.flatMap((item) =>
      item.kind === 'row' && item.rowState.ask != null
        ? [`${item.entry.kind}:${item.rowState.ask.kind}`]
        : [],
    );
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(asks).toEqual(['agent:restartStep']);
    expect(stateOf(runRow)).toBe('failed:stepFailed');
    expect(needsYouOwners({ items, entries: [], events: [] })).toHaveLength(1);
  });

  it('puts the one Continue on the stopped step row, never on the run row', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one', 'two'] }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'stopped',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const asks = items.flatMap((item) =>
      item.kind === 'row' && item.rowState.ask != null
        ? [`${item.entry.kind}:${item.rowState.ask.kind}`]
        : [],
    );
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(asks).toEqual(['agent:continue']);
    expect(stateOf(runRow)).toBe('waiting:stepStopped');
  });

  it('gives the Answer back to the asking agent when question rows are hidden', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one'] }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          startedAt: localIso({ day: 18, hour: 9 }),
          completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
          workflowRunId: RUN_ID,
        }),
      ],
      questions: [
        openQuestionFor({
          id: 'only-question',
          createdByAgentId: 'one',
          createdAt: localIso({ day: 18, hour: 9, minute: 30 }),
        }),
      ],
      showQuestions: false,
    });
    const asks = items.flatMap((item) =>
      item.kind === 'row' && item.rowState.ask?.kind === 'answer' ? [item.entry.kind] : [],
    );

    expect(asks).toEqual(['agent']);
    expect(needsYouOwners({ items, entries: [], events: [] })).toHaveLength(1);
  });

  it('leaves the run row off the question marker once the question is answered', () => {
    const { items } = stream({
      workflows: [
        attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one'] }),
      ],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
      questions: [
        answeredQuestionFor({
          id: 'answered-step-question',
          createdByAgentId: 'one',
          createdAt: localIso({ day: 18, hour: 9, minute: 5 }),
          answeredAt: localIso({ day: 18, hour: 9, minute: 10 }),
        }),
      ],
    });
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(stateOf(runRow)).toBe('running');
  });
});

describe('buildTimelineStream, project mount runs', () => {
  const projectRunOf = (item: TimelineStreamItem | undefined) => {
    if (item === undefined || item.kind !== 'row' || item.entry.kind !== 'event') {
      return null;
    }
    return item.entry.projectRun ?? null;
  };

  const rowsOf = (items: ReadonlyArray<TimelineStreamItem>) =>
    items.flatMap((item) => (item.kind === 'row' ? [item] : []));

  it('collapses a run of detachments into one row that keeps every name', () => {
    const { items } = stream({
      agents: [],
      events: ['api', 'storefront-web', 'infra'].map((projectName, index) =>
        sessionEvent({
          id: `ev-${projectName}`,
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10, minute: index }),
          payload: { projectName },
        }),
      ),
    });
    const rows = rowsOf(items);

    expect(rows).toHaveLength(1);
    expect(projectRunOf(rows[0])).toEqual({
      mounted: [],
      detached: ['infra', 'storefront-web', 'api'],
    });
  });

  it('carries both verbs on one row when a run mixes them', () => {
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_materialized',
          at: localIso({ day: 18, hour: 10, minute: 1 }),
          payload: { projectName: 'api' },
        }),
        sessionEvent({
          id: 'ev-storefront-web',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10, minute: 2 }),
          payload: { projectName: 'storefront-web' },
        }),
        sessionEvent({
          id: 'ev-infra',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10, minute: 3 }),
          payload: { projectName: 'infra' },
        }),
      ],
    });
    const rows = rowsOf(items);

    expect(rows).toHaveLength(1);
    expect(projectRunOf(rows[0])).toEqual({
      mounted: ['api'],
      detached: ['infra', 'storefront-web'],
    });
  });

  it('reads a mixed run as a mount, so it opens the files lens like a mount does', () => {
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_materialized',
          at: localIso({ day: 18, hour: 10, minute: 1 }),
          payload: { projectName: 'api' },
        }),
        sessionEvent({
          id: 'ev-storefront-web',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10, minute: 2 }),
          payload: { projectName: 'storefront-web' },
        }),
      ],
    });
    const row = rowsOf(items)[0];

    expect(row?.entry.kind === 'event' ? row.entry.event.kind : null).toBe('project_materialized');
  });

  it('leaves a run of detachments a detachment, which navigates nowhere', () => {
    const { items } = stream({
      agents: [],
      events: ['api', 'storefront-web'].map((projectName, index) =>
        sessionEvent({
          id: `ev-${projectName}`,
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10, minute: index }),
          payload: { projectName },
        }),
      ),
    });
    const row = rowsOf(items)[0];

    expect(row?.entry.kind === 'event' ? row.entry.event.kind : null).toBe('project_detached');
  });

  it('stamps the collapsed row with the newest event in the run', () => {
    const newestAt = localIso({ day: 18, hour: 11, minute: 30 });
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10 }),
          payload: { projectName: 'api' },
        }),
        sessionEvent({
          id: 'ev-storefront-web',
          kind: 'project_detached',
          at: newestAt,
          payload: { projectName: 'storefront-web' },
        }),
      ],
    });
    const row = rowsOf(items)[0];

    expect(row?.at).toBe(newestAt);
    expect(row?.id).toBe('event:ev-storefront-web');
  });

  it('keeps two mounts apart when another kind of event sits between them', () => {
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_materialized',
          at: localIso({ day: 18, hour: 10 }),
          payload: { projectName: 'api' },
        }),
        sessionEvent({
          id: 'ev-pr',
          kind: 'pr_created',
          at: localIso({ day: 18, hour: 11 }),
          payload: { number: 42 },
        }),
        sessionEvent({
          id: 'ev-storefront-web',
          kind: 'project_materialized',
          at: localIso({ day: 18, hour: 12 }),
          payload: { projectName: 'storefront-web' },
        }),
      ],
    });
    const rows = rowsOf(items);

    expect(rows.map((row) => row.id)).toEqual([
      'event:ev-storefront-web',
      'event:ev-pr',
      'event:ev-api',
    ]);
    expect(rows.every((row) => projectRunOf(row) == null)).toBe(true);
  });

  it('keeps mount runs apart across a day boundary', () => {
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_detached',
          at: localIso({ day: 17, hour: 23 }),
          payload: { projectName: 'api' },
        }),
        sessionEvent({
          id: 'ev-storefront-web',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 1 }),
          payload: { projectName: 'storefront-web' },
        }),
      ],
    });
    const rows = rowsOf(items);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => projectRunOf(row) == null)).toBe(true);
  });

  it('leaves a single mount exactly as it was', () => {
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_materialized',
          at: localIso({ day: 18, hour: 10 }),
          payload: { projectName: 'api', branch: 'goodboy/untitled' },
        }),
      ],
    });
    const rows = rowsOf(items);
    const row = rows[0];

    expect(rows).toHaveLength(1);
    expect(projectRunOf(row)).toBeNull();
    expect(row?.entry.kind === 'event' ? row.entry.event.payload : null).toEqual({
      projectName: 'api',
      branch: 'goodboy/untitled',
    });
  });

  it('leaves a nameless detachment on its own row, where the old copy still fits', () => {
    const { items } = stream({
      agents: [],
      events: [
        sessionEvent({
          id: 'ev-api',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 10 }),
          payload: { projectName: 'api' },
        }),
        sessionEvent({
          id: 'ev-nameless',
          kind: 'project_detached',
          at: localIso({ day: 18, hour: 11 }),
        }),
      ],
    });
    const rows = rowsOf(items);

    expect(rows.map((row) => row.id)).toEqual(['event:ev-nameless', 'event:ev-api']);
    expect(rows.every((row) => projectRunOf(row) == null)).toBe(true);
  });
});

describe('buildTimelineStream, row states from the run advance', () => {
  const twoSteps = () => {
    const attached = attachedWorkflow({
      createdAt: localIso({ day: 18, hour: 8 }),
      stepIds: ['one', 'two'],
    });
    const next = attached.workflow.steps[1];
    if (next === undefined) {
      throw new Error('fixture has two steps');
    }
    return { attached, next };
  };
  const agents = [
    agent({
      id: 'one',
      ordinal: 1,
      startedAt: localIso({ day: 18, hour: 9 }),
      completedAt: localIso({ day: 18, hour: 9, minute: 30 }),
      workflowRunId: RUN_ID,
    }),
    agent({ id: 'two', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
  ];

  it('says the next step waits for your click on the run and on the step itself', () => {
    const { attached, next } = twoSteps();
    const { items } = stream({
      workflows: [attached],
      agents,
      advanceByRunId: new Map([[RUN_ID, { kind: 'ready', step: next }]]),
    });
    const runRow = items.find((item) => item.id === 'run:run-1');
    const stepRow = items.find((item) => item.id === 'agent:two');

    expect(stateOf(runRow)).toBe('waiting:ready');
    expect(runRow?.kind === 'row' ? runRow.rowState.ask?.kind : null).toBe('runStep');
    expect(stateOf(stepRow)).toBe('waiting:ready');
    expect(stepRow?.kind === 'row' ? stepRow.rowState.ask : undefined).toBeNull();
  });

  it('keeps the run on the machine while the summarizer briefs the next step', () => {
    const { attached, next } = twoSteps();
    const { items } = stream({
      workflows: [attached],
      agents,
      advanceByRunId: new Map([
        [RUN_ID, { kind: 'blocked', reason: 'summarizer', step: next, failedStep: null }],
      ]),
    });

    expect(stateOf(items.find((item) => item.id === 'run:run-1'))).toBe('running:briefing');
  });

  it('shows the failed step on the run row instead of a generic warning', () => {
    const { attached, next } = twoSteps();
    const { items } = stream({
      workflows: [attached],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'failed',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
      advanceByRunId: new Map([
        [RUN_ID, { kind: 'blocked', reason: 'failed-step', step: next, failedStep: next }],
      ]),
    });
    const runRow = items.find((item) => item.id === 'run:run-1');

    expect(stateOf(runRow)).toBe('failed:stepFailed');
    expect(
      runRow?.kind === 'row' && runRow.rowState.reason?.kind === 'stepFailed'
        ? runRow.rowState.reason.stepLabel
        : null,
    ).toBe('1');
  });

  it('names the run a chained run waits on until that run finishes', () => {
    const first = attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }), stepIds: ['one'] });
    const chained = attachedWorkflow({
      runId: OTHER_RUN_ID,
      name: 'Deploy workflow',
      createdAt: localIso({ day: 18, hour: 9 }),
      stepIds: ['deploy'],
    });
    const { items } = stream({
      workflows: [first, { ...chained, run: { ...chained.run, chainAfterId: RUN_ID } }],
      agents: [
        agent({
          id: 'one',
          ordinal: 1,
          status: 'running',
          startedAt: localIso({ day: 18, hour: 9 }),
          workflowRunId: RUN_ID,
        }),
      ],
    });
    const chainedRow = items.find((item) => item.id === 'run:run-2');

    expect(stateOf(chainedRow)).toBe('queued:chained');
    expect(
      chainedRow?.kind === 'row' && chainedRow.rowState.reason?.kind === 'chained'
        ? chainedRow.rowState.reason.afterTitle
        : null,
    ).toBe('Release workflow');
  });
});

type RunTreeParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflow?: ReturnType<typeof attachedWorkflow>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
};

const runTree = ({
  agents,
  workflow = attachedWorkflow({ createdAt: localIso({ day: 18, hour: 8 }) }),
  questions = [],
}: RunTreeParams) => {
  const entry = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: [workflow],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions,
    worktrees: [],
    events: [],
    agentKindOverride: {},
  }).entries.find((candidate) => candidate.kind === 'run');
  if (entry === undefined || entry.kind !== 'run') {
    throw new Error('no run entry');
  }
  return buildRunTreeStream({ entry, unreadAgentIds: new Set(), advance: null, isDeciding: false });
};

describe('buildRunTreeStream', () => {
  const nestedRun: ReadonlyArray<Agent> = [
    agent({
      id: 'step-1',
      ordinal: 1,
      startedAt: localIso({ day: 18, hour: 8, minute: 10 }),
      completedAt: localIso({ day: 18, hour: 8, minute: 20 }),
      workflowRunId: RUN_ID,
    }),
    agent({
      id: 'step-2',
      ordinal: 2,
      status: 'running',
      startedAt: localIso({ day: 18, hour: 9 }),
      workflowRunId: RUN_ID,
    }),
    agent({ id: 'step-3', ordinal: 3, status: 'pending', workflowRunId: RUN_ID }),
    agent({
      id: 'child-1',
      ordinal: 4,
      status: 'running',
      startedAt: localIso({ day: 18, hour: 9, minute: 10 }),
      workflowRunId: RUN_ID,
      parentAgentId: 'step-2',
    }),
    agent({
      id: 'child-2',
      ordinal: 5,
      status: 'pending',
      workflowRunId: RUN_ID,
      parentAgentId: 'step-2',
    }),
  ];

  it('reads the run from its first step down, with no run row, no NOW and no day rule', () => {
    const { items } = runTree({ agents: nestedRun });

    expect(items.map(labelOf)).toEqual([
      'step:agent:step-1',
      'step:agent:step-2',
      'step:agent:child-1',
      'pending:agent:child-2',
      'pending:agent:step-3',
    ]);
  });

  it('ends a finished run on its last step and draws no NOW on a live one either', () => {
    const finishedAgents: ReadonlyArray<Agent> = [
      agent({
        id: 'step-1',
        ordinal: 1,
        status: 'completed',
        startedAt: localIso({ day: 18, hour: 8, minute: 10 }),
        completedAt: localIso({ day: 18, hour: 8, minute: 20 }),
        workflowRunId: RUN_ID,
      }),
      agent({
        id: 'step-2',
        ordinal: 2,
        status: 'completed',
        startedAt: localIso({ day: 18, hour: 8, minute: 30 }),
        completedAt: localIso({ day: 18, hour: 8, minute: 50 }),
        workflowRunId: RUN_ID,
      }),
    ];
    const finished = runTree({
      agents: finishedAgents,
      workflow: attachedWorkflow({
        createdAt: localIso({ day: 18, hour: 8 }),
        executionMode: 'dynamic',
        orchestrationOutcome: 'done',
      }),
    });
    const live = runTree({ agents: nestedRun });

    expect(finished.items.map(labelOf)).toEqual(['step:agent:step-1', 'step:agent:step-2']);
    expect(live.items.some((item) => item.kind === 'now')).toBe(false);
  });

  it('roots the run lane on the first step so the rail needs no session spine', () => {
    const { items, groups } = runTree({ agents: nestedRun });
    const layout = layoutTimelineRail({ rows: items, groups, hasSpine: false });
    const rowOf = (id: string) => layout.rows[items.findIndex((item) => item.id === id)];

    expect(groups.find((group) => group.id === 'lane:run:run-1')?.originRowId).toBe('agent:step-1');
    expect(rowOf('agent:step-1')?.markerColumn).toBe(0);
    expect(rowOf('agent:step-1')?.joins).toEqual([]);
    expect(rowOf('agent:step-1')?.segments.map((segment) => segment.column)).toEqual([0]);
    expect(rowOf('agent:step-2')?.joins.map((join) => `${join.kind}:${join.dash}`)).toEqual([
      'fork:solid',
    ]);
    expect(rowOf('agent:child-1')?.markerColumn).toBe(1);
    expect(rowOf('agent:child-2')?.joins).toEqual([]);
    expect(rowOf('agent:step-3')?.markerColumn).toBe(0);
  });

  it('keeps a queued run in execution order, the first step on top', () => {
    const { items } = runTree({
      agents: [
        agent({ id: 'step-1', ordinal: 1, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'step-2', ordinal: 2, status: 'pending', workflowRunId: RUN_ID }),
        agent({ id: 'step-3', ordinal: 3, status: 'pending', workflowRunId: RUN_ID }),
      ],
    });

    expect(items.map(labelOf)).toEqual([
      'pending:agent:step-1',
      'pending:agent:step-2',
      'pending:agent:step-3',
    ]);
  });

  it('puts the question on the step that asked, never on a delegate answering it', () => {
    const question = (id: string, createdBy: string): OpenQuestion => ({
      id: typedString<OpenQuestionId>({ value: id }),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      createdByAgentId: typedString<AgentId>({ value: createdBy }),
      text: 'Keep the legacy export?',
      suggestedAnswers: [],
      isBlocking: true,
      userAnswer: null,
      status: 'open',
      createdAt: typedString<IsoDateTime>({ value: localIso({ day: 18, hour: 9, minute: 30 }) }),
    });
    const delegate: Agent = {
      ...agent({
        id: 'delegate',
        ordinal: 6,
        status: 'running',
        startedAt: localIso({ day: 18, hour: 9, minute: 40 }),
        workflowRunId: RUN_ID,
        parentAgentId: 'step-2',
      }),
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
    };
    const { items } = runTree({
      agents: [...nestedRun, delegate],
      questions: [question('oq-1', 'child-1'), question('oq-2', 'delegate')],
    });
    const phaseOf = (id: string) =>
      items.flatMap((item) => (item.kind === 'row' && item.id === id ? [item] : []))[0]?.rowState
        .phase ?? null;

    expect(phaseOf('agent:child-1')).toBe('waiting');
    expect(phaseOf('agent:delegate')).toBe('running');
  });
});
