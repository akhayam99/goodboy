import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineStreamItem } from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { layoutTimelineRail } from './railGeometry';
import { markerCenterY, TIMELINE_RHYTHM } from './timelineRhythm';

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
});

type WorkflowParams = {
  readonly runId?: WorkflowRunId;
  readonly name?: string;
  readonly createdAt: string;
};

const attachedWorkflow = ({
  runId = RUN_ID,
  name = 'Release workflow',
  createdAt,
}: WorkflowParams): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = typedString<WorkflowId>({ value: `workflow-${runId}` });
  return {
    run: {
      id: runId,
      workflowId,
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
    },
    workflow: {
      id: workflowId,
      workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
      name,
      description: '',
      steps: [],
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
      updatedAt: typedString<IsoDateTime>({ value: createdAt }),
    },
  };
};

type StreamParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows?: ReadonlyArray<ReturnType<typeof attachedWorkflow>>;
  readonly unreadAgentIds?: ReadonlySet<string>;
};

const stream = ({ agents, workflows = [], unreadAgentIds = new Set() }: StreamParams) =>
  buildTimelineStream({
    entries: buildTimelineGroups({
      agents,
      workflows,
      plans: [],
      externalTasks: [],
      questions: [],
      worktrees: [],
      agentKindOverride: {},
    }).entries,
    unreadAgentIds,
    blockedRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
  });

const labelOf = (item: TimelineStreamItem): string => {
  if (item.kind === 'row') {
    return `${item.grade}:${item.id}`;
  }
  if (item.kind === 'cluster') {
    return `cluster:${item.steps.length}`;
  }
  if (item.kind === 'day') {
    return `day:${item.label}`;
  }
  return 'now';
};

describe('buildTimelineStream', () => {
  it('puts the run origin at the bottom of its group with steps stacking upward', () => {
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

    expect(items.map(labelOf)).toEqual([
      'now',
      'step:agent:three',
      'step:agent:two',
      'step:agent:one',
      'entry:run:run-1',
    ]);
  });

  it('numbers a run bottom to top so ordinals climb with the clock', () => {
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

  it('keeps every row of an unfinished run drawn whatever its age', () => {
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

    expect(items.map(labelOf)).toEqual([
      'now',
      'step:agent:todo',
      'day:Aug 10',
      'step:agent:done',
      'entry:run:run-1',
    ]);
  });

  it('draws a settled run from yesterday step by step instead of summarising it', () => {
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

    expect(items.map(labelOf)).toEqual([
      'now',
      'day:Yesterday',
      'step:agent:two',
      'step:agent:one',
      'entry:run:run-1',
    ]);
  });

  it('draws every entry of an old day in its own place, never behind a count', () => {
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

    expect(items.map(labelOf)).toEqual([
      'now',
      'day:Aug 12',
      'step:agent:two',
      'entry:run:run-2',
      'step:agent:one',
      'entry:run:run-1',
    ]);
  });

  it('emits one day divider per day whatever the age of the entries under it', () => {
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
    expect(items.map(labelOf)).toEqual([
      'now',
      'day:Aug 12',
      'entry:agent:loose',
      'step:agent:old',
      'entry:run:run-1',
    ]);
  });

  it('coalesces a stretch of consecutive pending steps into one marker', () => {
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
    const cluster = items.find((item) => item.kind === 'cluster');

    expect(items.map(labelOf)).toEqual([
      'now',
      'cluster:3',
      'step:agent:running',
      'entry:run:run-1',
    ]);
    expect(cluster?.kind === 'cluster' ? cluster.height : 0).toBe(
      3 * TIMELINE_RHYTHM.grade.pending.height,
    );
  });

  it('leaves one lone pending step as its own row', () => {
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

    expect(items.map(labelOf)).toEqual([
      'now',
      'step:agent:next',
      'step:agent:running',
      'entry:run:run-1',
    ]);
  });

  it('breaks the day inside a run that crossed midnight and keeps its lane whole', () => {
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
    const dayIndex = items.findIndex((item) => item.kind === 'day' && item.label === 'Aug 16');
    const dayRail = layout.rows[dayIndex];

    expect(items.map(labelOf)).toEqual([
      'now',
      'day:Yesterday',
      'step:agent:after',
      'day:Aug 16',
      'step:agent:before',
      'entry:run:run-1',
    ]);
    expect(dayRail?.segments.filter((segment) => segment.column === 1)).toHaveLength(1);
  });

  it('hangs a fan-out on its own stub one column past the step it belongs to', () => {
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

    expect(items.map(labelOf)).toEqual([
      'now',
      'step:agent:sub-a',
      'step:agent:implement',
      'entry:run:run-1',
    ]);
    expect(layout.columnByGroupId.get('lane:run:run-1')).toBe(1);
    expect(layout.columnByGroupId.get('lane:agent:implement')).toBe(2);
  });

  it('interleaves a standalone agent between two steps without breaking the run', () => {
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
    const looseIndex = items.findIndex((item) => item.id === 'agent:loose');

    expect(items.map(labelOf)).toEqual([
      'now',
      'step:agent:step-two',
      'entry:agent:loose',
      'step:agent:step-one',
      'entry:run:run-1',
    ]);
    expect(layout.rows[looseIndex]?.markerColumn).toBe(0);
    expect(
      layout.rows[looseIndex]?.segments.filter((segment) => segment.column === 1),
    ).toHaveLength(1);
  });

  it('centres a marker on its label line, not on a row box carrying leading air', () => {
    const withAir = markerCenterY({ grade: 'entry', gap: 'entry' });
    const boxCentre = (TIMELINE_RHYTHM.gap.entry + TIMELINE_RHYTHM.grade.entry.height) / 2;

    expect(withAir).toBe(TIMELINE_RHYTHM.gap.entry + TIMELINE_RHYTHM.grade.entry.height / 2);
    expect(withAir).not.toBe(boxCentre);
  });

  it('separates two entries more than two steps of one run', () => {
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
});
