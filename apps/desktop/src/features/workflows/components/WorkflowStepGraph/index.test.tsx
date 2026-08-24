// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
  TelemetryRecord,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { brandColor } from '../../../providers/components/provider-brand';
import { useAppStore } from '../../../../store';
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
      sessionProvider={null}
      sessionEffort={null}
      selectedAgentId={null}
      onSelect={onSelect}
    />,
  );
  return onSelect;
};

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState({ sessionTelemetry: {}, agentRunHistory: {} });
});

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

  it('keeps the planned routing for a step that has not run yet', () => {
    renderGraph(new Map());

    expect(screen.getByTitle('Model: claude-sonnet-4-5')).toBeDefined();
    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('shows the model that actually ran and names the plan it replaced', () => {
    useAppStore.setState({
      agentRunHistory: { [scout.id]: ['run-1' as ProviderRunId] },
      sessionTelemetry: {
        [SESSION_ID]: [
          {
            id: 'rec-1',
            runId: 'run-1' as ProviderRunId,
            sessionId: SESSION_ID,
            kind: 'turn',
            provider: 'gemini',
            model: 'gemini-3-pro',
            inputTokens: 10,
            outputTokens: 2,
            estimatedCostUsd: 0.1,
            recordedAt: NOW,
          } as TelemetryRecord,
        ],
      },
    });

    renderGraph(new Map());

    expect(screen.getByTitle('Model: gemini-3-pro')).toBeDefined();
    expect(screen.queryByTitle('Model: claude-sonnet-4-5')).toBeNull();
    const note = screen.getByTestId('routing-divergence');
    expect(note.textContent).toBe('was Sonnet 4.5');
    expect(note.getAttribute('title')).toContain('Planned Claude Sonnet 4.5');
    expect(note.getAttribute('title')).toContain('ran Gemini');
  });

  it('shows the provider the agent runs on instead of guessing it from the model id', () => {
    renderGraph(new Map(), vi.fn(), { 'agent-2': 'cursor' });

    const chip = screen.getByRole('button', { name: /Implement/ });

    expect(chip.outerHTML).toContain(brandColor('cursor'));
    expect(chip.outerHTML).not.toContain(brandColor('codex'));
  });
});
