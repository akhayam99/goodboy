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
  type TimelineRowItem,
  type TimelineStreamItem,
} from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { groupSummaryText } from './groupSummary';
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

describe('buildTimelineStream steps group', () => {
  it('counts the context the run added as Context +N', () => {
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
    const fold = rowOf({ items, id: RUN_ROW }).fold;
    expect(fold === undefined ? null : groupSummaryText({ summary: fold.summary })).toBe(
      '3 steps · Context +3',
    );
  });

  it('leaves Context out when the run only took context away', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      events: [contextEvent({ id: 'e1', payload: { withdrawn: 1, agentId: 'plan' } })],
    });
    const fold = rowOf({ items, id: RUN_ROW }).fold;
    expect(fold === undefined ? null : groupSummaryText({ summary: fold.summary })).toBe('3 steps');
  });

  it('shows a finished run as its one row with what was inside', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      questions: [question({ id: 'q1', agentId: 'plan', status: 'answered' })],
    });
    expect(rowIds({ items })).toEqual([RUN_ROW]);
    const fold = rowOf({ items, id: RUN_ROW }).fold;
    expect(fold?.isExpanded).toBe(false);
    expect(fold === undefined ? null : groupSummaryText({ summary: fold.summary })).toBe(
      '3 steps · 1 question answered',
    );
  });

  it('opens the run back to the same rows in the same order', () => {
    const agents = finishedSteps();
    const questions = [question({ id: 'q1', agentId: 'plan', status: 'answered' })];
    const flat = streamOf({ agents, questions, foldsFinished: false });
    const opened = streamOf({ agents, questions, expanded: [RUN_ROW] });
    expect(rowIds(opened)).toEqual(rowIds(flat));
    expect(rowIds(opened)).toContain('question:q1');
    expect(rowOf({ items: opened.items, id: 'agent:scout' }).explode).toEqual({
      groupId: RUN_ROW,
      kind: 'steps',
    });
    expect(rowOf({ items: opened.items, id: RUN_ROW }).fold?.isExpanded).toBe(true);
  });

  it('keeps a run open while a question in it needs you', () => {
    const { items } = streamOf({
      agents: finishedSteps(),
      questions: [question({ id: 'q1', agentId: 'build', status: 'open' })],
    });
    expect(rowIds({ items })).toContain('agent:build');
    expect(rowOf({ items, id: RUN_ROW }).fold).toBeUndefined();
  });

  it('keeps a live run open', () => {
    const agents = [
      step({ id: 'scout', ordinal: 1 }),
      step({ id: 'plan', ordinal: 2 }),
      step({ id: 'build', ordinal: 3, status: 'running' }),
    ];
    const { items } = streamOf({ agents });
    expect(rowIds({ items })).toEqual(['agent:build', 'agent:plan', 'agent:scout', RUN_ROW]);
    expect(rowOf({ items, id: RUN_ROW }).fold).toBeUndefined();
  });

  it('keeps a failed run open', () => {
    const agents = [
      step({ id: 'scout', ordinal: 1 }),
      step({ id: 'plan', ordinal: 2 }),
      step({ id: 'build', ordinal: 3, status: 'failed' }),
    ];
    const { items } = streamOf({ agents });
    expect(rowIds({ items })).toContain('agent:build');
  });

  it('draws no lane for a folded run but keeps its column', () => {
    const { items, groups } = streamOf({ agents: finishedSteps() });
    expect(groups.map((group) => group.id)).toEqual([`head:${RUN_ROW}`]);
    const folded = layoutTimelineRail({ rows: items, groups });
    const opened = streamOf({ agents: finishedSteps(), expanded: [RUN_ROW] });
    expect(folded.width).toBe(
      layoutTimelineRail({ rows: opened.items, groups: opened.groups }).width,
    );
  });

  it('hangs a folded run on a head with a ball one column in and no lane', () => {
    const { items, groups } = streamOf({ agents: finishedSteps() });

    expect(groups).toEqual([
      expect.objectContaining({
        id: `head:${RUN_ROW}`,
        originRowId: RUN_ROW,
        parentGroupId: null,
        shape: 'head',
      }),
    ]);
    expect(rowOf({ items, id: RUN_ROW }).groupId).toBe(`head:${RUN_ROW}`);
    const rail = layoutTimelineRail({ rows: items, groups });
    const runRail = rail.rows[items.findIndex((item) => item.id === RUN_ROW)];
    expect(runRail?.markerColumn).toBe(1);
    expect(runRail?.joins.map((join) => join.kind)).toEqual(['stub']);
  });

  it('hangs an open run on a head and its steps on a lane under it', () => {
    const { items, groups } = streamOf({ agents: finishedSteps(), expanded: [RUN_ROW] });
    const head = groups.find((group) => group.id === `head:${RUN_ROW}`);
    const lane = groups.find((group) => group.id === `lane:${RUN_ROW}`);

    expect(head).toEqual(expect.objectContaining({ shape: 'head', parentGroupId: null }));
    expect(lane?.parentGroupId).toBe(`head:${RUN_ROW}`);
    expect(rowOf({ items, id: RUN_ROW }).groupId).toBe(`head:${RUN_ROW}`);
    expect(rowOf({ items, id: 'agent:scout' }).groupId).toBe(`lane:${RUN_ROW}`);
    const rail = layoutTimelineRail({ rows: items, groups });
    expect(rail.columnByGroupId.get(`head:${RUN_ROW}`)).toBe(1);
    expect(rail.columnByGroupId.get(`lane:${RUN_ROW}`)).toBe(2);
    const runRail = rail.rows[items.findIndex((item) => item.id === RUN_ROW)];
    expect(runRail?.joins.map((join) => join.kind)).toEqual(['stub', 'branch']);
  });

  it('keeps the lane and the head on one identity so hover reaches both', () => {
    const { groups } = streamOf({ agents: finishedSteps(), expanded: [RUN_ROW] });
    const head = groups.find((group) => group.id === `head:${RUN_ROW}`);
    const lane = groups.find((group) => group.id === `lane:${RUN_ROW}`);

    expect(head?.identityIndex).toBe(lane?.identityIndex);
    expect(head?.isMuted).toBe(lane?.isMuted);
  });

  it('gives a live run no head since it has no fold', () => {
    const agents = [
      step({ id: 'scout', ordinal: 1 }),
      step({ id: 'plan', ordinal: 2 }),
      step({ id: 'build', ordinal: 3, status: 'running' }),
    ];
    const { groups } = streamOf({ agents });

    expect(groups.some((group) => group.shape === 'head')).toBe(false);
  });

  it('gives a run page no head', () => {
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

    expect(tree.groups.some((group) => group.shape === 'head')).toBe(false);
  });

  it('hangs a folded and an open agent chain on a head', () => {
    const agents = [
      chainAgent({ id: 'lead', ordinal: 1 }),
      chainAgent({ id: 'child-a', ordinal: 2, parentAgentId: 'lead' }),
      chainAgent({ id: 'child-b', ordinal: 3, parentAgentId: 'lead' }),
      chainAgent({ id: 'grand', ordinal: 4, parentAgentId: 'child-a' }),
    ];
    const folded = streamOf({ agents, hasWorkflow: false });
    const opened = streamOf({ agents, hasWorkflow: false, expanded: [CHAIN_ROW] });

    expect(folded.groups.map((group) => group.shape)).toEqual(['head']);
    expect(rowOf({ items: folded.items, id: CHAIN_ROW }).groupId).toBe(`head:${CHAIN_ROW}`);
    expect(opened.groups.find((group) => group.id === `head:${CHAIN_ROW}`)?.shape).toBe('head');
    expect(opened.groups.find((group) => group.id === `lane:${CHAIN_ROW}`)?.parentGroupId).toBe(
      `head:${CHAIN_ROW}`,
    );
  });

  it('keeps the run page flat', () => {
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
    expect(rowIds(tree)).toEqual(['agent:build', 'agent:plan', 'agent:scout']);
  });

  it('folds a finished agent chain into its lead row', () => {
    const agents = [
      chainAgent({ id: 'lead', ordinal: 1 }),
      chainAgent({ id: 'child-a', ordinal: 2, parentAgentId: 'lead' }),
      chainAgent({ id: 'child-b', ordinal: 3, parentAgentId: 'lead' }),
      chainAgent({ id: 'grand', ordinal: 4, parentAgentId: 'child-a' }),
    ];
    const { items } = streamOf({ agents, hasWorkflow: false });
    expect(rowIds({ items })).toEqual([CHAIN_ROW]);
    const fold = rowOf({ items, id: CHAIN_ROW }).fold;
    expect(fold === undefined ? null : groupSummaryText({ summary: fold.summary })).toBe(
      '3 subagents',
    );
  });

  it('leaves a short chain as it is', () => {
    const agents = [
      chainAgent({ id: 'lead', ordinal: 1 }),
      chainAgent({ id: 'child-a', ordinal: 2, parentAgentId: 'lead' }),
    ];
    const { items } = streamOf({ agents, hasWorkflow: false });
    expect(rowIds({ items })).toEqual(['agent:child-a', CHAIN_ROW]);
  });
});
