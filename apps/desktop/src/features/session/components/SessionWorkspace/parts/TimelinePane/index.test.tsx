// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

type Worktree = {
  readonly id: string;
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly mountName?: string;
  readonly createdAt: number;
};

const { storeState, diffStats, unread } = vi.hoisted(() => ({
  unread: { current: false },
  diffStats: { current: new Map<string, { additions: number; deletions: number }>() },
  storeState: {
    sessionPhaseRuns: {},
    sessionPlans: {},
    sessionExternalTasks: {},
    sessionWorktreeRecords: {} as Record<string, ReadonlyArray<unknown>>,
    sessionEvents: {},
    agentKindOverride: {},
    loadSessionEvents: vi.fn(async () => undefined),
    markAllAgentsSeen: vi.fn(),
    setActiveLens: vi.fn(),
    openMountDiff: vi.fn(),
  },
}));

vi.mock('../../../../../../store', () => {
  const useAppStore = <T,>(selector: (state: typeof storeState) => T) => selector(storeState);
  useAppStore.getState = () => storeState;
  return {
    EMPTY_ARRAY: Object.freeze([]),
    agentHasUnread: () => unread.current,
    useAppStore,
    useMountDiffStats: () => diffStats.current,
    useSessionOpenQuestions: () => [],
  };
});
vi.mock('../../../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => [],
}));
vi.mock('../../../../../workflows/useAdvanceWorkflowAgent', () => ({
  useAdvanceWorkflowAgent: () => vi.fn(),
}));
vi.mock('../../../../../workflows/useWorkflowAdvanceStates', () => ({
  useWorkflowAdvanceStates: () => new Map(),
}));
vi.mock('../../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('./ActivityFilterButton', () => ({
  ActivityFilterButton: () => <button type="button">Filter</button>,
}));

import { TimelinePane } from './index';

const SESSION = {
  id: 'session-1',
  workspaceId: 'ws-1',
  goal: 'ship it',
  workflowRuns: [],
} as unknown as Session;

const RUNS = { lanes: [], blockedLanes: [], completedLanes: [] } as never;

const WORKTREE: Worktree = {
  id: 'wt-1',
  sessionId: 'session-1',
  worktreePath: '/worktrees/api',
  branch: 'ak/feat-x',
  parallelIndex: 0,
  mountName: 'api',
  createdAt: Date.parse('2026-08-20T10:00:00.000Z'),
};

beforeEach(() => {
  storeState.sessionWorktreeRecords = {};
  storeState.sessionPhaseRuns = {};
  storeState.sessionEvents = {};
  storeState.openMountDiff.mockReset();
  storeState.markAllAgentsSeen.mockReset();
  unread.current = false;
  diffStats.current = new Map();
  localStorage.clear();
});

afterEach(cleanup);

describe('TimelinePane mount rows', () => {
  it('turns the mount row action into the diff once the mount has changes', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 7, deletions: 1 }]]);

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    const action = screen.getByRole('button', { name: 'View diff' });
    fireEvent.click(action);

    expect(storeState.openMountDiff).toHaveBeenCalledWith('session-1', '/worktrees/api');
    expect(screen.getByTestId('diff-stat').textContent).toBe('+7-1');
  });

  it('keeps the path copy on a mount with nothing changed', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 0, deletions: 0 }]]);

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByRole('button', { name: 'Copy path' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'View diff' })).toBeNull();
  });
});

describe('TimelinePane under a full filter', () => {
  it('reads an all-hidden timeline as filtered, not empty', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    localStorage.setItem(
      'goodboy:activity-filter',
      JSON.stringify({
        worktree: false,
        issues: false,
        pullRequests: false,
        workflows: false,
        plans: false,
        agents: false,
        resolver: false,
        decisions: false,
      }),
    );

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByText(/hidden by the activity filter/)).toBeDefined();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy path' })).toBeNull();
  });
});

describe('TimelinePane on an empty session', () => {
  it('keeps the header actions mounted above a quiet empty line', () => {
    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={<button type="button">Add workflow</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add workflow' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeDefined();
    expect(screen.getByText(/Nothing yet/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });
});

describe('TimelinePane kickoff', () => {
  it('hands the empty session to the kickoff once events are known', () => {
    storeState.sessionEvents = { 'session-1': [] };

    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.getByTestId('kickoff')).toBeDefined();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
  });

  it('holds the quiet line until the session events resolve', () => {
    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.queryByTestId('kickoff')).toBeNull();
    expect(screen.getByText(/Nothing yet/)).toBeDefined();
  });

  it('steps aside as soon as the timeline holds any activity', () => {
    storeState.sessionEvents = { 'session-1': [] };
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };

    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.queryByTestId('kickoff')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeDefined();
  });
});

describe('TimelinePane unread affordance', () => {
  it('seats Mark all seen on the NOW rule and marks everything on click', () => {
    storeState.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'agent-1',
          sessionId: 'session-1',
          ordinal: 1,
          name: 'scout',
          status: 'completed',
          startedAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    };
    unread.current = true;
    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    const cta = screen.getByRole('button', { name: 'Mark all seen' });
    fireEvent.click(cta);
    expect(storeState.markAllAgentsSeen).toHaveBeenCalledWith('session-1');
  });

  it('hides the CTA once nothing is unread', () => {
    storeState.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'agent-1',
          sessionId: 'session-1',
          ordinal: 1,
          name: 'scout',
          status: 'completed',
          startedAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    };
    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });
});
