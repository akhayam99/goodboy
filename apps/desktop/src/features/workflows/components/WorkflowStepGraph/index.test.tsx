// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  EffortLevel,
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

type GraphOptions = {
  readonly agentEffortOverride?: Record<string, EffortLevel>;
  readonly openQuestionAgentIds?: ReadonlySet<AgentId>;
  readonly onAnswerQuestions?: () => void;
};

const renderGraph = (
  children: ReadonlyMap<string, ReadonlyArray<Agent>>,
  onSelect = vi.fn(),
  agentProviderOverride: Record<string, 'cursor'> = {},
  {
    agentEffortOverride = {},
    openQuestionAgentIds = new Set(),
    onAnswerQuestions = vi.fn(),
  }: GraphOptions = {},
) => {
  render(
    <WorkflowStepGraph
      workflow={workflow}
      runs={[scout, implement]}
      childrenByParentId={children}
      agentKindOverride={{}}
      agentModelOverride={{}}
      agentProviderOverride={agentProviderOverride}
      agentEffortOverride={agentEffortOverride}
      openQuestionAgentIds={openQuestionAgentIds}
      onAnswerQuestions={onAnswerQuestions}
      roleModels={null}
      sessionProvider={null}
      sessionEffort={null}
      selectedAgentId={null}
      onSelect={onSelect}
    />,
  );
  return onSelect;
};

const railSvgOf = (id: string): Element => {
  const svg = screen.getByTestId(`workflow-step-rail-${id}`).firstElementChild;
  if (svg === null) {
    throw new Error(`no rail drawn for ${id}`);
  }
  return svg;
};

const railColumnOf = (id: string): string | null =>
  screen
    .getByTestId(`workflow-step-rail-${id}`)
    .querySelector('[data-rail-column]')
    ?.getAttribute('data-rail-column') ?? null;

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState({ sessionTelemetry: {}, agentRunHistory: {} });
});

const spokenMarkerOf = (marker: string): HTMLElement | undefined =>
  screen.getAllByText(marker).find((element) => element.className.includes('sr-only'));

describe('WorkflowStepGraph', () => {
  it('numbers the steps down the spine and shows a fan-out without asking', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    for (const marker of ['1', '2', '1.1', '1.2']) {
      expect(spokenMarkerOf(marker)).toBeDefined();
    }
    expect(screen.getByText('Scout area 1')).toBeDefined();
  });

  it('keeps the numbering for screen readers once the rail replaces it', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed')]]]));

    for (const marker of ['1', '2', '1.1']) {
      const label = spokenMarkerOf(marker);
      expect(label?.closest('button')).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: /^1 /u })).toBeDefined();
  });

  it('gives every depth its own rail column and branches the cluster off its parent', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(railColumnOf(scout.id)).toBe('0');
    expect(railColumnOf('child-1')).toBe('1');
    expect(railColumnOf('child-2')).toBe('1');
    expect(railColumnOf(implement.id)).toBe('0');
    expect(railSvgOf(scout.id).querySelectorAll('path')).toHaveLength(1);
    expect(railSvgOf(implement.id).querySelectorAll('path')).toHaveLength(0);
  });

  it('runs the rail solid once every step has started', () => {
    renderGraph(new Map());

    const started = [...railSvgOf(scout.id).querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );
    const ahead = [...railSvgOf(implement.id).querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );

    expect(started).toEqual([null]);
    expect(ahead).toEqual([null]);
  });

  it('dashes the rail into a step nobody has started yet', () => {
    renderGraph(new Map([[implement.id, [subScout(1, 'pending')]]]));

    const dashes = [...railSvgOf('child-1').querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );

    expect(dashes).toContain('3 3');
  });

  it('marks the rail done, running, and not started the way the activity timeline does', () => {
    renderGraph(new Map([[implement.id, [subScout(1, 'pending')]]]));

    expect(screen.getByRole('img', { name: 'Done' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Running' }).className).toContain('spin-border');
    const pending = screen.getByRole('img', { name: 'Not started' });
    expect(pending.textContent).toBe('1');
    expect(pending.querySelector('circle')?.getAttribute('stroke-dasharray')).not.toBeNull();
  });

  it('counts the children without offering a way to fold them away', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(screen.getByText('1/2')).toBeDefined();
    expect(screen.queryByRole('button', { name: /agents under Scout/i })).toBeNull();
  });

  it('counts a child the user closed as done', () => {
    renderGraph(
      new Map([[scout.id, [{ ...subScout(1, 'failed'), doneAt: NOW }, subScout(2, 'running')]]]),
    );

    expect(screen.getByText('1/2')).toBeDefined();
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
    expect(screen.queryByTestId('routing-divergence')).toBeNull();
    expect(screen.getByLabelText('planned model Sonnet 4.5')).toBeDefined();
  });

  it('shows the provider the agent runs on instead of guessing it from the model id', () => {
    renderGraph(new Map(), vi.fn(), { 'agent-2': 'cursor' });

    const chip = screen.getByRole('button', { name: /Implement/ });

    expect(chip.outerHTML).toContain(brandColor('cursor'));
    expect(chip.outerHTML).not.toContain(brandColor('codex'));
  });

  it('says a delegate row is answering for the step that asked', () => {
    const delegate = agent({
      id: 'delegate-1' as AgentId,
      parentAgentId: scout.id,
      ordinal: 0,
      name: 'answer: pick a database',
      status: 'running',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
    });

    renderGraph(new Map([[scout.id, [delegate]]]));

    expect(screen.getByTestId('answers-for-delegate-1').textContent).toBe('answering for Scout');
  });

  it('leaves an ordinary sub-agent row without an answering line', () => {
    renderGraph(new Map([[scout.id, [subScout(0, 'running')]]]));

    expect(screen.queryByTestId('answers-for-child-0')).toBeNull();
  });

  it('marks the step that asked a question and offers Answer on that row only', () => {
    const onAnswerQuestions = vi.fn();
    renderGraph(
      new Map(),
      vi.fn(),
      {},
      {
        openQuestionAgentIds: new Set([implement.id]),
        onAnswerQuestions,
      },
    );

    expect(screen.getByLabelText('Waiting on your answer')).toBeDefined();
    expect(screen.queryByLabelText('Running')).toBeNull();
    expect(screen.getByText('Needs you')).toBeDefined();
    const answers = screen.getAllByRole('button', { name: 'Answer' });
    expect(answers).toHaveLength(1);

    fireEvent.click(answers[0]!);

    expect(onAnswerQuestions).toHaveBeenCalledTimes(1);
  });

  it('shows the question on a nested cluster row, not only on the step', () => {
    renderGraph(
      new Map([[implement.id, [subScout(1, 'running')]]]),
      vi.fn(),
      {},
      {
        openQuestionAgentIds: new Set(['child-1' as AgentId]),
      },
    );

    expect(
      screen
        .getByTestId('workflow-step-rail-child-1')
        .querySelector('[aria-label="Waiting on your answer"]'),
    ).not.toBeNull();
    expect(screen.getByLabelText('Running')).toBeDefined();
  });

  it('keeps a question delegate out of the waiting state, since the question belongs to its step', () => {
    const delegate = agent({
      id: 'delegate-1' as AgentId,
      parentAgentId: scout.id,
      ordinal: 0,
      name: 'answer: pick a database',
      status: 'running',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
    });

    renderGraph(
      new Map([[scout.id, [delegate]]]),
      vi.fn(),
      {},
      {
        openQuestionAgentIds: new Set([delegate.id]),
      },
    );

    expect(screen.queryByLabelText('Waiting on your answer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('shows the planned effort next to the model of each step', () => {
    renderGraph(new Map(), vi.fn(), {}, { agentEffortOverride: { [implement.id]: 'low' } });

    const efforts = screen.getAllByTitle('Effort').map((node) => node.textContent);

    expect(efforts).toContain('Low');
  });
});
