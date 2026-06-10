// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('fires open-workspace-settings with the session workspace id when the name is clicked', () => {
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-settings', spy);
    render(<ChatBreadcrumb session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'goodboy' }));
    expect(spy).toHaveBeenCalledOnce();
    const event = spy.mock.calls[0]![0] as CustomEvent<{ workspaceId: string }>;
    expect(event.detail.workspaceId).toBe('ws-1');
    window.removeEventListener('goodboy:open-workspace-settings', spy);
  });

  it('does not fire the legacy open-settings event', () => {
    const legacy = vi.fn();
    window.addEventListener('goodboy:open-settings', legacy);
    render(<ChatBreadcrumb session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'goodboy' }));
    expect(legacy).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-settings', legacy);
  });

  it('renders no clickable workspace button when none is linked', () => {
    state.workspaces = [];
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-settings', spy);
    render(<ChatBreadcrumb session={session} />);
    expect(screen.queryByRole('button')).toBeNull();
    window.removeEventListener('goodboy:open-workspace-settings', spy);
  });
});
