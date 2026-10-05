// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionContextItem,
  SessionContextItemId,
  SessionEvent,
  SessionEventId,
  SessionEventPayload,
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
import {
  buildRunTreeStream,
  buildTimelineStream,
  type TimelineCountItem,
  type TimelineRowItem,
  type TimelineStreamItem,
} from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { groupSummaryText } from './groupSummary';
import { CONTEXT_LABEL, decisionCountsText } from './sessionEventPresentation';
import { layoutTimelineRail } from '../../workTreeModel/railGeometry';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const RUN_ROW = 'run:run-1';
const CHAIN_ROW = 'agent:lead';
const NOW = new Date(2026, 7, 18, 12, 0);

const at = ({ hour, minute = 0 }: { readonly hour: number; readonly minute?: number }) =>
  new Date(2026, 7, 18, hour, minute).toISOString() as IsoDateTime;

type StepParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly status?: Agent['status'];
};

const step = ({ id, ordinal, status = 'completed' }: StepParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${id}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: id,
  status,
  ...(status === 'pending' ? {} : { startedAt: at({ hour: 9, minute: ordinal * 5 }) }),
  ...(status === 'completed' ? { completedAt: at({ hour: 9, minute: ordinal * 5 + 2 }) } : {}),
});

const STEP_IDS = ['scout', 'plan', 'build'] as const;

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

const finishedSteps = (): ReadonlyArray<Agent> =>
  STEP_IDS.map((id, index) => step({ id, ordinal: index + 1 }));

const question = ({
  id,
  agentId,
  status,
}: {
  readonly id: string;
  readonly agentId: string;
  readonly status: OpenQuestion['status'];
}): OpenQuestion => ({
  id: id as OpenQuestionId,
  sessionId: SESSION_ID,
  createdByAgentId: agentId as AgentId,
  text: id,
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: status === 'open' ? null : 'yes',
  status,
  createdAt: at({ hour: 9, minute: 11 }),
  ...(status === 'answered' ? { answeredAt: at({ hour: 9, minute: 12 }) } : {}),
});

const chainAgent = ({
  id,
  ordinal,
  parentAgentId,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly parentAgentId?: string;
}): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal,
  name: id,
  status: 'completed',
  ...(parentAgentId === undefined ? {} : { parentAgentId: parentAgentId as AgentId }),
  startedAt: at({ hour: 10, minute: ordinal }),
  completedAt: at({ hour: 10, minute: ordinal + 1 }),
});

type StreamParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly expanded?: ReadonlyArray<string>;
  readonly foldsFinished?: boolean;
  readonly hasWorkflow?: boolean;
  readonly events?: ReadonlyArray<SessionEvent>;
  readonly learnings?: ReadonlyArray<SessionContextItem>;
};

const streamOf = ({
  agents,
  questions = [],
  expanded = [],
  foldsFinished = true,
  hasWorkflow = true,
  events = [],
  learnings = [],
}: StreamParams) => {
  const entries = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: hasWorkflow ? [workflow()] : [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions,
    worktrees: [],
    events,
    learnings,
    agentKindOverride: {},
  }).entries;
  return {
    entries,
    ...buildTimelineStream({
      entries,
      unreadAgentIds: new Set(),
      advanceByRunId: new Map(),
      decidingRunIds: new Set(),
      dayLabelFor: ({ at: when }) => dayLabel({ at: when, now: NOW }),
      expandedGroupIds: new Set(expanded),
      foldsFinished,
    }),
  };
};

const rowIds = ({ items }: { readonly items: ReadonlyArray<TimelineStreamItem> }) =>
  items.flatMap((item) => (item.kind === 'row' ? [item.id] : []));

const rowOf = ({
  items,
  id,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly id: string;
}): TimelineRowItem => {
  const found = items.find(
    (item): item is TimelineRowItem => item.kind === 'row' && item.id === id,
  );
  if (found === undefined) {
    throw new Error(`row ${id} is missing`);
  }
  return found;
};

const contextEvent = ({
  id,
  payload,
}: {
  readonly id: string;
  readonly payload: SessionEventPayload;
}): SessionEvent => ({
  id: id as SessionEventId,
  sessionId: SESSION_ID,
  kind: 'decisions_changed',
  payload,
  createdAt: at({ hour: 9, minute: 13 }),
});

const learning = ({ id, agentId }: { readonly id: string; readonly agentId: string }) =>
  ({
    id: id as SessionContextItemId,
    sessionId: SESSION_ID,
    workspaceId: 'workspace-1' as WorkspaceId,
    kind: 'learning',
    title: 'Refunds keep the ledger key',
    text: 'Refunds keep the ledger key',
    topic: null,
    source: { role: 'implementer', agentId: agentId as AgentId, turnStart: 1, turnEnd: 1 },
    audience: [],
    status: 'active',
    createdAt: at({ hour: 9, minute: 14 }),
    projectName: null,
    isSessionDeleted: false,
    updatedAt: at({ hour: 9, minute: 14 }),
  }) satisfies SessionContextItem;

const countOf = ({
  items,
  expandId,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly expandId: string;
}): TimelineCountItem | null => {
  const found = items.find(
    (item): item is TimelineCountItem => item.kind === 'count' && item.expandId === expandId,
  );
  return found ?? null;
};

const phraseOf = ({
  items,
  expandId,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly expandId: string;
}): string | null => {
  const count = countOf({ items, expandId });
  return count === null ? null : groupSummaryText({ summary: count.summary });
};

describe('buildTimelineStream steps group', () => {
  it('names the context the run changed with the same counts as its rows', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      events: [
        contextEvent({ id: 'e1', payload: { added: 1, replaced: 1, agentId: 'plan' } }),
        contextEvent({ id: 'e2', payload: { withdrawn: 2, agentId: 'scout' } }),
        contextEvent({ id: 'e3', payload: { added: 4 } }),
        contextEvent({ id: 'e4', payload: { added: 5, agentId: 'elsewhere' } }),
      ],
      learnings: [learning({ id: 'l1', agentId: 'build' })],
    });

    expect(phraseOf({ items, expandId: RUN_ROW })).toBe(
      '3 steps · Context · 2 added, 1 replaced, 2 withdrawn',
    );
  });

  it('shows the count row phrase with the context counts of its rows', () => {
    const payload = { added: 2, replaced: 2, agentId: 'plan' };
    const opened = streamOf({
      agents: finishedSteps(),
      events: [contextEvent({ id: 'e1', payload })],
      expanded: [RUN_ROW],
    });
    const closed = streamOf({
      agents: finishedSteps(),
      events: [contextEvent({ id: 'e1', payload })],
    });
    const row = rowOf({ items: opened.items, id: 'event:e1' });

    expect(
      row.entry.kind === 'event' ? decisionCountsText({ payload: row.entry.event.payload }) : null,
    ).toBe('2 added, 2 replaced');
    expect(phraseOf({ items: closed.items, expandId: RUN_ROW })).toBe(
      `3 steps · ${CONTEXT_LABEL} · 2 added, 2 replaced`,
    );
  });

  it('leaves Context out of the phrase when no context row changed anything', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      events: [contextEvent({ id: 'e1', payload: { agentId: 'plan' } })],
    });

    expect(phraseOf({ items, expandId: RUN_ROW })).toBe('3 steps');
  });

  it('puts the context rows of a run agent on the run lane and hides them when folded', () => {
    const events = [
      contextEvent({ id: 'e1', payload: { added: 1, agentId: 'plan' } }),
      contextEvent({ id: 'e2', payload: { added: 3 } }),
    ];
    const learnings = [learning({ id: 'l1', agentId: 'build' })];
    const opened = streamOf({ agents: finishedSteps(), events, learnings, expanded: [RUN_ROW] });
    const closed = streamOf({ agents: finishedSteps(), events, learnings });

    expect(rowOf({ items: opened.items, id: 'event:e1' }).groupId).toBe(`lane:${RUN_ROW}`);
    expect(rowOf({ items: opened.items, id: 'event:e1' }).grade).toBe('fact');
    expect(rowOf({ items: opened.items, id: 'learning:l1' }).groupId).toBe(`lane:${RUN_ROW}`);
    expect(rowIds(closed)).toEqual(['event:e2', RUN_ROW]);
  });

  it('grades an answered lane question as a compact fact and an open one as a step', () => {
    const answered = streamOf({
      agents: finishedSteps(),
      questions: [question({ id: 'q1', agentId: 'plan', status: 'answered' })],
      expanded: [RUN_ROW],
    });
    const open = streamOf({
      agents: finishedSteps(),
      questions: [question({ id: 'q2', agentId: 'plan', status: 'open' })],
    });

    expect(rowOf({ items: answered.items, id: 'question:q1' }).grade).toBe('fact');
    expect(rowOf({ items: open.items, id: 'question:q2' }).grade).toBe('step');
  });

  it('never lets a row clock rise down a run when a question was answered hours later', () => {
    const late: OpenQuestion = {
      ...question({ id: 'q1', agentId: 'plan', status: 'answered' }),
      answeredAt: at({ hour: 15 }),
    };
    const { items } = streamOf({
      agents: finishedSteps(),
      questions: [late],
      events: [contextEvent({ id: 'e1', payload: { added: 1, agentId: 'plan' } })],
      expanded: [RUN_ROW],
    });
    const clocks = items.flatMap((item) =>
      item.kind === 'row' && item.at != null ? [item.at] : [],
    );

    expect(clocks.length).toBeGreaterThan(3);
    expect(clocks).toEqual([...clocks].sort((first, second) => second.localeCompare(first)));
  });

  it('keeps a context event without an agent on the spine', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      events: [contextEvent({ id: 'e3', payload: { added: 4 } })],
      expanded: [RUN_ROW],
    });

    expect(rowOf({ items, id: 'event:e3' }).groupId).toBeNull();
  });

  it('keeps a context event of an agent outside any run on the spine', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      events: [contextEvent({ id: 'e4', payload: { added: 5, agentId: 'elsewhere' } })],
      expanded: [RUN_ROW],
    });

    expect(rowOf({ items, id: 'event:e4' }).groupId).toBeNull();
  });

  it('shows a finished run as its one row with a count row above it', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      questions: [question({ id: 'q1', agentId: 'plan', status: 'answered' })],
    });
    const count = countOf({ items, expandId: RUN_ROW });

    expect(rowIds({ items })).toEqual([RUN_ROW]);
    expect(count?.isExpanded).toBe(false);
    expect(phraseOf({ items, expandId: RUN_ROW })).toBe('3 steps · 1 question answered');
    expect(rowOf({ items, id: RUN_ROW }).branches).toEqual([
      { expandId: RUN_ROW, isExpanded: false },
    ]);
  });

  it('opens the run back to the same rows, newest first, under its count row', () => {
    const agents = finishedSteps();
    const questions = [question({ id: 'q1', agentId: 'plan', status: 'answered' })];
    const flat = streamOf({ agents, questions, foldsFinished: false });
    const opened = streamOf({ agents, questions, expanded: [RUN_ROW] });

    expect(rowIds(opened)).toEqual(rowIds(flat));
    expect(rowIds(opened)).toContain('question:q1');
    expect(opened.items.map((item) => item.id).slice(0, 2)).toEqual(['now', `count:${RUN_ROW}`]);
    expect(rowOf({ items: opened.items, id: 'agent:scout' }).explode).toEqual({
      groupId: RUN_ROW,
      kind: 'steps',
    });
    expect(countOf({ items: opened.items, expandId: RUN_ROW })?.isExpanded).toBe(true);
  });

  it('keeps a run open while a question in it needs you', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      questions: [question({ id: 'q1', agentId: 'build', status: 'open' })],
    });

    expect(rowIds({ items })).toContain('agent:build');
    expect(countOf({ items, expandId: RUN_ROW })).toBeNull();
    expect(rowOf({ items, id: RUN_ROW }).branches).toBeUndefined();
  });

  it('keeps a live run open, with every step above its row and no count row', () => {
    const agents = [
      step({ id: 'scout', ordinal: 1 }),
      step({ id: 'plan', ordinal: 2 }),
      step({ id: 'build', ordinal: 3, status: 'running' }),
    ];
    const { items } = streamOf({ agents });

    expect(rowIds({ items })).toEqual(['agent:build', 'agent:plan', 'agent:scout', RUN_ROW]);
    expect(items.some((item) => item.kind === 'count')).toBe(false);
    expect(rowOf({ items, id: RUN_ROW }).branches).toBeUndefined();
  });

  it('keeps a failed run open', () => {
    const agents = [
      step({ id: 'scout', ordinal: 1 }),
      step({ id: 'plan', ordinal: 2 }),
      step({ id: 'build', ordinal: 3, status: 'failed' }),
    ];
    const { items } = streamOf({ agents });

    expect(rowIds({ items })).toContain('agent:build');
    expect(items.some((item) => item.kind === 'count')).toBe(false);
  });

  it('keeps the lane of a folded run up to its count row and the same width once open', () => {
    const { items, groups } = streamOf({ agents: finishedSteps() });
    const folded = layoutTimelineRail({ rows: items, groups });
    const opened = streamOf({ agents: finishedSteps(), expanded: [RUN_ROW] });

    expect(groups.map((group) => group.id)).toEqual([`lane:${RUN_ROW}`]);
    expect(folded.width).toBe(
      layoutTimelineRail({ rows: opened.items, groups: opened.groups }).width,
    );
  });

  it('hangs a folded run on its lane: the run row on the spine, the count row on the lane', () => {
    const { items, groups } = streamOf({ agents: finishedSteps() });

    expect(groups).toEqual([
      expect.objectContaining({
        id: `lane:${RUN_ROW}`,
        originRowId: RUN_ROW,
        parentGroupId: null,
        direction: 'up',
        shape: 'merged',
      }),
    ]);
    expect(rowOf({ items, id: RUN_ROW }).groupId).toBeNull();
    const rail = layoutTimelineRail({ rows: items, groups });
    const runRail = rail.rows[items.findIndex((item) => item.id === RUN_ROW)];
    const countRail = rail.rows[items.findIndex((item) => item.id === `count:${RUN_ROW}`)];

    expect(runRail?.markerColumn).toBe(0);
    expect(runRail?.joins.map((join) => join.kind)).toEqual(['branch']);
    expect(countRail?.markerColumn).toBe(1);
  });

  it('hangs the steps of an open run on one lane that branches off the run marker', () => {
    const { items, groups } = streamOf({ agents: finishedSteps(), expanded: [RUN_ROW] });
    const lane = groups.find((group) => group.id === `lane:${RUN_ROW}`);

    expect(groups).toHaveLength(1);
    expect(lane?.parentGroupId).toBeNull();
    expect(rowOf({ items, id: RUN_ROW }).groupId).toBeNull();
    expect(rowOf({ items, id: 'agent:scout' }).groupId).toBe(`lane:${RUN_ROW}`);
    const rail = layoutTimelineRail({ rows: items, groups });
    expect(rail.columnByGroupId.get(`lane:${RUN_ROW}`)).toBe(1);
    const runRail = rail.rows[items.findIndex((item) => item.id === RUN_ROW)];
    expect(runRail?.joins.map((join) => join.kind)).toEqual(['branch']);
  });

  it('draws the lane of a live run open, dashed up to NOW', () => {
    const agents = [
      step({ id: 'scout', ordinal: 1 }),
      step({ id: 'plan', ordinal: 2 }),
      step({ id: 'build', ordinal: 3, status: 'running' }),
    ];
    const { groups } = streamOf({ agents });

    expect(groups.find((group) => group.id === `lane:${RUN_ROW}`)?.shape).toBe('open');
  });

  it('keeps the run page flat, in execution order, with no count row', () => {
    const { entries } = streamOf({ agents: finishedSteps() });
    const run = entries.find((entry) => entry.kind === 'run');
    if (run?.kind !== 'run') {
      throw new Error('run entry is missing');
    }
    const tree = buildRunTreeStream({
      entry: run,
      unreadAgentIds: new Set(),
      advance: null,
      isDeciding: false,
    });

    expect(rowIds(tree)).toEqual(['agent:scout', 'agent:plan', 'agent:build']);
    expect(tree.items.some((item) => item.kind === 'count')).toBe(false);
    expect(tree.groups.every((group) => group.direction === 'down')).toBe(true);
  });

  const CHAIN: ReadonlyArray<Agent> = [
    chainAgent({ id: 'lead', ordinal: 1 }),
    chainAgent({ id: 'child-a', ordinal: 2, parentAgentId: 'lead' }),
    chainAgent({ id: 'child-b', ordinal: 3, parentAgentId: 'lead' }),
    chainAgent({ id: 'grand', ordinal: 4, parentAgentId: 'child-a' }),
  ];

  it('folds a finished agent chain behind a count row of its direct subagents', () => {
    const { items } = streamOf({ agents: CHAIN, hasWorkflow: false });

    expect(rowIds({ items })).toEqual([CHAIN_ROW]);
    expect(phraseOf({ items, expandId: `subagents:${CHAIN_ROW}` })).toBe('2 subagents');
  });

  it('opens a chain onto a lane under no head, each child with its own count row', () => {
    const { items, groups } = streamOf({
      agents: CHAIN,
      hasWorkflow: false,
      expanded: [`subagents:${CHAIN_ROW}`],
    });

    expect(groups.some((group) => group.id === `lane:${CHAIN_ROW}`)).toBe(true);
    expect(groups.find((group) => group.id === `lane:${CHAIN_ROW}`)?.parentGroupId).toBeNull();
    expect(rowIds({ items })).toEqual(['agent:child-b', 'agent:child-a', CHAIN_ROW]);
    expect(phraseOf({ items, expandId: 'subagents:agent:child-a' })).toBe('1 subagent');
  });

  it('folds a short chain too, since every finished branch folds', () => {
    const agents = [
      chainAgent({ id: 'lead', ordinal: 1 }),
      chainAgent({ id: 'child-a', ordinal: 2, parentAgentId: 'lead' }),
    ];
    const { items } = streamOf({ agents, hasWorkflow: false });

    expect(rowIds({ items })).toEqual([CHAIN_ROW]);
    expect(phraseOf({ items, expandId: `subagents:${CHAIN_ROW}` })).toBe('1 subagent');
  });
});
