// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  selectAgent: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
  EMPTY_ARRAY: [] as never[],
}));

import { WorkflowBreadcrumb } from './WorkflowBreadcrumb';

const SESSION_ID = 'session-1' as SessionId;

const buildAgent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'Implement',
    status: 'running',
    kind: 'implementer',
    ...overrides,
  }) as Agent;

const root = buildAgent({
  id: 'agent-root' as AgentId,
  stepId: 'step-1' as never,
  workflowRunId: 'run-1' as never,
});
const childDone = buildAgent({
  id: 'agent-c1' as AgentId,
  name: 'cluster one',
  ordinal: 1,
  status: 'completed',
  parentAgentId: 'agent-root' as AgentId,
  workflowRunId: 'run-1' as never,
});
const childRunning = buildAgent({
  id: 'agent-c2' as AgentId,
  name: 'cluster two',
  ordinal: 2,
  parentAgentId: 'agent-root' as AgentId,
  workflowRunId: 'run-1' as never,
});

const session = {
  id: SESSION_ID,
  workspaceId: 'ws-1',
  workflowRuns: [{ id: 'run-1', workflowId: 'wf-1' }],
} as unknown as Session;

const workflow = {
  id: 'wf-1',
  steps: [{ id: 'step-1', name: 'Implement' }],
};

const renderCrumb = (selectedAgentId: AgentId) =>
  render(
    <WorkflowBreadcrumb
      sessionId={SESSION_ID}
      session={session}
      selectedAgentId={selectedAgentId}
      homeLabel="Workflows"
      onHome={vi.fn()}
    />,
  );

beforeEach(() => {
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    sessionPhaseRuns: { [SESSION_ID]: [root, childDone, childRunning] },
    phaseTemplates: { 'ws-1': [workflow] },
    sessionWorkflows: { [SESSION_ID]: [] },
    selectAgent: h.selectAgent,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowBreadcrumb', () => {
  it('shows the cluster counter instead of repeating the step name on the root', () => {
    renderCrumb(root.id);

    expect(screen.getAllByText('Implement')).toHaveLength(1);
    expect(screen.getByText('1/2 clusters')).toBeTruthy();
  });

  it('shows the child name when a cluster child is selected', () => {
    renderCrumb(childRunning.id);

    expect(screen.getByText('Implement')).toBeTruthy();
    expect(screen.getByText('cluster two')).toBeTruthy();
    expect(screen.queryByText('1/2 clusters')).toBeNull();
  });

  it('counts a skipped cluster child as done', () => {
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: [root, childDone, { ...childRunning, status: 'skipped' }],
    };

    renderCrumb(root.id);

    expect(screen.getByText('2/2 clusters')).toBeTruthy();
  });

  it('excludes non-implementer children from the cluster count and menu', () => {
    const branch = buildAgent({
      id: 'agent-branch' as AgentId,
      name: 'parallel branch',
      ordinal: 3,
      kind: 'scout',
      parentAgentId: root.id,
      stepId: 'branch-step' as never,
      workflowRunId: 'run-1' as never,
    });
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: [root, childDone, childRunning, branch],
    };

    renderCrumb(root.id);

    expect(screen.getByText('1/2 clusters')).toBeTruthy();
    fireEvent.click(screen.getByTitle('1/2 clusters. Switch agent.'));
    expect(screen.getByRole('menu', { name: 'switch agent' }).textContent).not.toContain(
      'parallel branch',
    );
  });

  it('lists the root and every child in the agent menu', () => {
    renderCrumb(root.id);

    fireEvent.click(screen.getByTitle('1/2 clusters. Switch agent.'));

    const menu = screen.getByRole('menu', { name: 'switch agent' });
    expect(menu.textContent).toContain('cluster one');
    expect(menu.textContent).toContain('cluster two');
    expect(h.selectAgent).not.toHaveBeenCalled();
  });
});
