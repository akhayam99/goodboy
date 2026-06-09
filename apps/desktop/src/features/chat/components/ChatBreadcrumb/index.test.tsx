// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

type MockState = {
  workspaces: ReadonlyArray<{ id: string; name: string }>;
  selectedAgentId: Record<string, string>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  sessionWorkflows: Record<string, ReadonlyArray<unknown>>;
  agentKindOverride: Record<string, string>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    workspaces: [{ id: 'ws-1', name: 'goodboy' }],
    selectedAgentId: {},
    sessionPhaseRuns: {},
    sessionWorkflows: {},
    agentKindOverride: {},
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}));

import { ChatBreadcrumb } from './index';

beforeEach(() => {
  state.workspaces = [{ id: 'ws-1', name: 'goodboy' }];
  state.selectedAgentId = {};
  state.sessionPhaseRuns = {};
  state.sessionWorkflows = {};
  state.agentKindOverride = {};
});
afterEach(cleanup);

const session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'fix tests',
  workflowRuns: [],
} as unknown as Session;

describe('ChatBreadcrumb', () => {
  it('renders the workspace name and the session goal', () => {
    render(<ChatBreadcrumb session={session} />);
    expect(screen.getByText('goodboy')).toBeDefined();
    expect(screen.getByText('fix tests')).toBeDefined();
  });

  it('falls back to "untitled session" when the goal is empty', () => {
    const blank = { ...session, goal: '   ' } as Session;
    render(<ChatBreadcrumb session={blank} />);
    expect(screen.getByText('untitled session')).toBeDefined();
  });

  it('renders an explicit no-workspace label when none is linked', () => {
    state.workspaces = [];
    render(<ChatBreadcrumb session={session} />);
    expect(screen.getByText('no workspace')).toBeDefined();
  });
});
