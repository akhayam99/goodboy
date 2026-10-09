// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';

const { storeState, renders, attachedRuns, stable } = vi.hoisted(() => ({
  stable: { list: [] as ReadonlyArray<unknown>, stats: new Map<string, unknown>() },
  renders: { entry: 0, now: 0, day: 0 },
  attachedRuns: { list: [] as ReadonlyArray<unknown> },
  storeState: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPlans: {},
    sessionArtifacts: {},
    sessionExternalTasks: {},
    sessionWorktreeRecords: {} as Record<string, ReadonlyArray<unknown>>,
    sessionEvents: {} as Record<string, ReadonlyArray<unknown>>,
    selectedAgentId: {},
    transcripts: {},
    projects: [],
    sessionProjectMounts: {},
    agentKindOverride: {},
    agentProviderOverride: {},
    agentModelOverride: {},
    agentEffortOverride: {},
    agentRunHistory: {},
    sessionTelemetry: {},
    executed: new Map<string, { provider: string; model: string }>(),
    sessionTurnSpans: {},
    workspaceDurationHistory: {},
    agentTurnState: {},
    loadSessionTurnSpans: vi.fn(async () => undefined),
    loadWorkspaceDurationHistory: vi.fn(async () => undefined),
    loadSessionEvents: vi.fn(async () => undefined),
    loadSessionArtifacts: vi.fn(async () => undefined),
    sessionContextItems: {} as Record<string, ReadonlyArray<unknown>>,
    loadSessionContextItems: vi.fn(async () => undefined),
    loadSessionAnsweredQuestions: vi.fn(async () => undefined),
    loadSessionDismissedQuestions: vi.fn(async () => undefined),
    markAllAgentsSeen: vi.fn(),
    navigate: vi.fn(),
    openMountDiff: vi.fn(),
    requestOpenQuestionScroll: vi.fn(),
  },
}));

vi.mock('../../../../../../store', async () => {
  const useAppStore = <T,>(selector: (state: typeof storeState) => T) => selector(storeState);
  useAppStore.getState = () => storeState;
  return {
    ...(await import('../../../../../../store/slices/navigation/place')),
    EMPTY_ARRAY: Object.freeze([]),
    agentHasUnread: () => false,
    useAppStore,
    useMountDiffStats: () => stable.stats,
    useSessionOpenQuestions: () => stable.list,
    useSessionAnsweredQuestions: () => stable.list,
    useSessionDismissedQuestions: () => stable.list,
    useIsSessionCollectionLoaded: () => true,
    useExecutedAgentRouting: ({ agent }: { readonly agent: { readonly id: string } }) =>
      storeState.executed.get(agent.id) ?? null,
  };
});
vi.mock('../../../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));
vi.mock('../../../SessionOverviewPane/SessionCostChip', () => ({
  SessionCostChip: () => <span>$3.47</span>,
}));
vi.mock('../../../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <button type="button">Start agent</button>,
}));
vi.mock('../../../../hooks/useResolveActivity', () => {
  const activity = { batchByAgentId: new Map(), factsByAgentId: new Map() };
  return { useResolveActivity: () => activity };
});
vi.mock('../../../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => attachedRuns.list,
}));
vi.mock('../../../../../workflows/useAdvanceWorkflowAgent', () => ({
  useAdvanceWorkflowAgent: () => vi.fn(),
}));
vi.mock('../../../../../workflows/useWorkflowAdvanceStates', () => {
  const states = new Map();
  return { useWorkflowAdvanceStates: () => states };
});
vi.mock('../../../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('./TimelineEntryRow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./TimelineEntryRow')>();
  return {
    ...actual,
    TimelineEntryRow: (props: Parameters<typeof actual.TimelineEntryRow>[0]) => {
      renders.entry += 1;
      return actual.TimelineEntryRow(props);
    },
  };
});
vi.mock('./TimelineNowRule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./TimelineNowRule')>();
  return {
    ...actual,
    TimelineNowRule: (props: Parameters<typeof actual.TimelineNowRule>[0]) => {
      renders.now += 1;
      return actual.TimelineNowRule(props);
    },
  };
});
vi.mock('./TimelineDayRule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./TimelineDayRule')>();
  return {
    ...actual,
    TimelineDayRule: (props: Parameters<typeof actual.TimelineDayRule>[0]) => {
      renders.day += 1;
      return actual.TimelineDayRule(props);
    },
  };
});

import {
  RAIL_CONTENT_PAD,
  RAIL_LABEL_GAP,
  RAIL_LANE_OFFSET,
  RAIL_MARKER_RADIUS,
  RAIL_SPINE_X,
} from '../../../../../workTreeModel/railGeometry';
import { TimelinePane } from './index';

const SESSION: Session = aSession({
  id: 'session-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship it',
});

const WORKFLOW = {
  id: 'workflow-1',
  workspaceId: 'ws-1',
  name: 'Ship the checkout fix',
  description: '',
  origin: 'library',
  steps: [1, 2, 3, 4].map((ordinal) => ({
    id: `step-${ordinal}`,
    workflowId: 'workflow-1',
    ordinal: ordinal - 1,
    name: `Step ${ordinal}`,
    promptPrefix: '',
    role: 'implementer',
  })),
  createdAt: '2026-08-20T10:30:00.000Z',
  updatedAt: '2026-08-20T10:30:00.000Z',
};

const RUN = {
  run: {
    id: 'run-1',
    workflowId: 'workflow-1',
    ordinal: 0,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'manual',
    executionMode: 'static',
    createdAt: '2026-08-20T10:30:00.000Z',
  },
  workflow: WORKFLOW,
};

const stepAgent = (index: number) => ({
  id: `agent-${index}`,
  sessionId: 'session-1',
  stepId: `step-${index}`,
  workflowRunId: 'run-1',
  ordinal: index,
  name: `Step ${index}`,
  status: index === 3 ? 'running' : 'completed',
  startedAt: `2026-08-20T10:3${index}:00.000Z`,
  ...(index === 3 ? {} : { completedAt: `2026-08-20T10:3${index}:30.000Z` }),
});

const soloAgent = (index: number) => ({
  id: `solo-${index}`,
  sessionId: 'session-1',
  ordinal: -(index + 1),
  name: `Solo ${index}`,
  status: 'completed',
  startedAt: `2026-08-20T09:0${index}:00.000Z`,
  completedAt: `2026-08-20T09:0${index}:30.000Z`,
});

const totalRenders = () => renders.entry + renders.now + renders.day;

const pane = ({ actions }: { readonly actions: ReactNode }) => (
  <TimelinePane session={SESSION} actions={actions} />
);

beforeEach(() => {
  renders.entry = 0;
  renders.now = 0;
  renders.day = 0;
  attachedRuns.list = [RUN];
  storeState.sessionPhaseRuns = {
    'session-1': [...[1, 2, 3].map(stepAgent), ...[0, 1, 2, 3].map(soloAgent)],
  };
  storeState.sessionEvents = { 'session-1': [] };
});

afterEach(cleanup);

describe('TimelinePane, row renders', () => {
  it('draws the run and its steps on a lane in the run colour, dashed to NOW, with the lane to hit', () => {
    const view = render(pane({ actions: null }));
    const strokes = Array.from(
      view.container.querySelectorAll('[data-testid="timeline-rail-segment"]'),
    );
    const laneStrokes = strokes.filter(
      (line) => line.getAttribute('stroke') !== 'var(--color-border)',
    );

    expect(view.container.querySelectorAll('[data-row-id]').length).toBe(8);
    expect(renders.entry).toBe(8);
    expect(laneStrokes.length).toBeGreaterThan(0);
    expect(
      laneStrokes.every((line) => line.getAttribute('stroke')?.startsWith('var(--color-identity-')),
    ).toBe(true);
    expect(laneStrokes.some((line) => line.getAttribute('stroke-dasharray') !== null)).toBe(true);
    expect(view.container.querySelectorAll('svg.overflow-visible path').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('timeline-lane-hit').length).toBeGreaterThan(0);
  });

  it('indents a step by exactly one lane column and keeps its label next to its marker', () => {
    const view = render(pane({ actions: null }));
    const railWidthOf = (label: string): number => {
      const row = Array.from(view.container.querySelectorAll('[data-row-id]')).find((candidate) =>
        candidate.textContent?.includes(label),
      );
      const rail = row?.children[1];
      return rail instanceof HTMLElement ? Number.parseFloat(rail.style.width) : Number.NaN;
    };
    const solo = railWidthOf('Solo 0');
    const step = railWidthOf('Step 1');

    expect(solo).toBe(RAIL_SPINE_X + RAIL_MARKER_RADIUS + RAIL_LABEL_GAP - RAIL_CONTENT_PAD);
    expect(step - solo).toBe(RAIL_LANE_OFFSET);
  });

  it('opens the run page from its lane', () => {
    render(pane({ actions: null }));
    const [hit] = screen.getAllByTestId('timeline-lane-hit');

    expect(hit?.getAttribute('aria-label')).toBe('Open run: Ship the checkout fix');
  });

  it('re-renders no row when the parent re-renders with the same data', () => {
    const view = render(pane({ actions: null }));
    renders.entry = 0;
    renders.now = 0;
    renders.day = 0;

    view.rerender(pane({ actions: <span>Create</span> }));

    expect(totalRenders()).toBe(0);
  });

  it('re-renders only the rows a group changes when it opens among two hundred rows', () => {
    const lead = {
      id: 'lead',
      sessionId: 'session-1',
      ordinal: 500,
      name: 'Implement the banner',
      status: 'completed',
      startedAt: '2026-08-21T10:00:00.000Z',
      completedAt: '2026-08-21T10:20:00.000Z',
    };
    const children = [1, 2, 3].map((index) => ({
      id: `sub-${index}`,
      sessionId: 'session-1',
      ordinal: 500 + index,
      name: `Scout part ${index}`,
      parentAgentId: 'lead',
      status: 'completed',
      startedAt: `2026-08-21T10:0${index}:00.000Z`,
      completedAt: `2026-08-21T10:0${index}:30.000Z`,
    }));
    const many = Array.from({ length: 200 }, (_, index) => ({
      id: `many-${index}`,
      sessionId: 'session-1',
      ordinal: -(index + 10),
      name: `Older agent ${index}`,
      status: 'completed',
      startedAt: new Date(Date.parse('2026-08-19T10:00:00.000Z') - index * 60_000).toISOString(),
      completedAt: new Date(Date.parse('2026-08-19T10:00:30.000Z') - index * 60_000).toISOString(),
    }));
    attachedRuns.list = [];
    storeState.sessionPhaseRuns = { 'session-1': [lead, ...children, ...many] };
    const view = render(pane({ actions: null }));
    expect(view.container.querySelectorAll('[data-row-id]').length).toBe(202);
    renders.entry = 0;
    renders.now = 0;
    renders.day = 0;

    fireEvent.click(screen.getByRole('button', { name: /3 subagents/ }));

    expect(view.container.querySelectorAll('[data-row-id]').length).toBe(205);
    expect(renders.entry).toBeLessThanOrEqual(6);
    expect(renders.day).toBe(0);
  });

  it('re-renders no row when the pointer crosses the rows', () => {
    const view = render(pane({ actions: null }));
    renders.entry = 0;

    for (const row of Array.from(view.container.querySelectorAll('[data-row-id]'))) {
      fireEvent.mouseEnter(row);
      fireEvent.mouseLeave(row);
    }

    expect(renders.entry).toBe(0);
  });
});
