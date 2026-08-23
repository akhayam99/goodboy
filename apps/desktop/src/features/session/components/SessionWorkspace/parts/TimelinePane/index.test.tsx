// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { storeState } = vi.hoisted(() => ({
  storeState: {
    sessionPhaseRuns: {},
    sessionPlans: {},
    sessionExternalTasks: {},
    sessionWorktreeRecords: {},
    sessionEvents: {},
    agentKindOverride: {},
    loadSessionEvents: vi.fn(async () => undefined),
    markAllAgentsSeen: vi.fn(),
    setActiveLens: vi.fn(),
  },
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: () => false,
  useAppStore: <T,>(selector: (state: typeof storeState) => T) => selector(storeState),
  useMountDiffStats: () => new Map(),
  useSessionOpenQuestions: () => [],
}));
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

afterEach(cleanup);

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
