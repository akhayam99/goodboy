// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { brandColor } from '../../../providers/components/provider-brand';
import { WorkflowStepGraph } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const NOW = '2026-07-31T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Ship',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
      modelOverride: 'claude-sonnet-4-5',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      promptPrefix: '',
      modelOverride: 'gpt-5.1-codex',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const agent = (patch: Partial<Agent> & Pick<Agent, 'id' | 'ordinal' | 'name'>): Agent => ({
  sessionId: SESSION_ID,
  status: 'pending',
  ...patch,
});

const scout = agent({
  id: 'agent-1' as AgentId,
  stepId: 'step-1' as StepId,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
});
const implement = agent({
  id: 'agent-2' as AgentId,
  stepId: 'step-2' as StepId,
  ordinal: 1,
  name: 'Implement',
  status: 'running',
});

const subScout = (index: number, status: Agent['status']): Agent =>
  agent({
    id: `child-${index}` as AgentId,
    parentAgentId: scout.id,
    ordinal: index,
    name: `Scout area ${index}`,
    status,
  });

const renderGraph = (
  children: ReadonlyMap<string, ReadonlyArray<Agent>>,
  onSelect = vi.fn(),
  agentProviderOverride: Record<string, 'cursor'> = {},
) => {
  render(
    <WorkflowStepGraph
      workflow={workflow}
      runs={[scout, implement]}
      childrenByParentId={children}
      agentKindOverride={{}}
      agentModelOverride={{}}
      agentProviderOverride={agentProviderOverride}
      roleModels={null}
      selectedAgentId={null}
      onSelect={onSelect}
    />,
  );
  return onSelect;
};

afterEach(cleanup);

describe('WorkflowStepGraph', () => {
  it('numbers the steps down the spine and shows a fan-out without asking', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Scout area 1')).toBeDefined();
    expect(screen.getByText('1.1')).toBeDefined();
    expect(screen.getByText('1.2')).toBeDefined();
  });

  it('counts the children without offering a way to fold them away', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(screen.getByText('1/2')).toBeDefined();
    expect(screen.queryByRole('button', { name: /agents under Scout/i })).toBeNull();
  });

  it('keeps showing the status of a node that has children', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed')]]]));

    expect(screen.getByLabelText('Scout status: completed')).toBeDefined();
    expect(screen.getByLabelText('Implement status: running')).toBeDefined();
  });

  it('opens the chat of the step that was clicked', () => {
    const onSelect = renderGraph(new Map());

    fireEvent.click(screen.getByRole('button', { name: /Implement/ }));

    expect(onSelect).toHaveBeenCalledWith(implement.id);
  });

  it('shows the provider the agent runs on instead of guessing it from the model id', () => {
    renderGraph(new Map(), vi.fn(), { 'agent-2': 'cursor' });

    const chip = screen.getByRole('button', { name: /Implement/ });

    expect(chip.outerHTML).toContain(brandColor('cursor'));
    expect(chip.outerHTML).not.toContain(brandColor('codex'));
  });
});
