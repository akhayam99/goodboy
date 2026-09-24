// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  EffortLevel,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProviderId,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  TelemetryRecord,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { brandColor } from '../../../providers/components/provider-brand';
import { useAppStore } from '../../../../store';
import { RunTree } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-31T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
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
    {
      id: 'step-3' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 2,
      name: 'Review',
      promptPrefix: '',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  createdAt: NOW,
};

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  workflowRuns: [run],
} as unknown as Session;

const agent = (patch: Partial<Agent> & Pick<Agent, 'id' | 'ordinal' | 'name'>): Agent => ({
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  status: 'pending',
  ...patch,
});

const scout = agent({
  id: 'agent-1' as AgentId,
  stepId: 'step-1' as StepId,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
  startedAt: '2026-07-31T01:00:00.000Z' as IsoDateTime,
  completedAt: '2026-07-31T01:10:00.000Z' as IsoDateTime,
});
const implement = agent({
  id: 'agent-2' as AgentId,
  stepId: 'step-2' as StepId,
  ordinal: 1,
  name: 'Implement',
  status: 'running',
  startedAt: '2026-07-31T02:00:00.000Z' as IsoDateTime,
});
const review = agent({
  id: 'agent-3' as AgentId,
  stepId: 'step-3' as StepId,
  ordinal: 2,
  name: 'Review',
});

const child = (index: number, patch: Partial<Agent> = {}): Agent =>
  agent({
    id: `child-${index}` as AgentId,
    parentAgentId: implement.id,
    ordinal: 10 + index,
    name: `Part ${index}`,
    status: 'running',
    startedAt: `2026-07-31T02:0${index}:00.000Z` as IsoDateTime,
    ...patch,
  });

const question = (id: string, createdBy: AgentId): OpenQuestion => ({
  id: id as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  createdByAgentId: createdBy,
  text: 'Keep the legacy export?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
});

type RenderParams = {
  readonly agents?: ReadonlyArray<Agent>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly agentProviderOverride?: Record<string, ProviderId>;
  readonly agentEffortOverride?: Record<string, EffortLevel>;
  readonly selectedAgentId?: AgentId | null;
  readonly onSelect?: (id: AgentId) => void;
  readonly onAnswer?: (question: OpenQuestion | null) => void;
};

const renderTree = ({
  agents = [scout, implement, review],
  questions = [],
  agentProviderOverride = {},
  agentEffortOverride = {},
  selectedAgentId = null,
  onSelect = vi.fn(),
  onAnswer = vi.fn(),
}: RenderParams = {}) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [...questions] },
    agentProviderOverride,
    agentEffortOverride,
  });
  render(
    <RunTree
      session={session}
      run={run}
      workflow={workflow}
      agentKindOverride={{}}
      routing={{
        stepById: new Map(workflow.steps.map((step) => [step.id, step])),
        roleModels: null,
        sessionProvider: null,
        sessionEffort: null,
      }}
      selectedAgentId={selectedAgentId}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />,
  );
};

const rowOf = (id: string): HTMLElement => screen.getByTestId(`run-tree-row-${id}`);

const metaOf = (id: string, column: 'model' | 'effort' | 'cost'): string | null =>
  rowOf(id).querySelector(`[data-meta-column="${column}"]`)?.textContent ?? null;

const rowIds = (): ReadonlyArray<string> =>
  screen
    .getAllByTestId(/^run-tree-row-/u)
    .map((row) => row.dataset.testid?.replace('run-tree-row-', '') ?? '');

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
  });
});

afterEach(cleanup);

describe('RunTree', () => {
  it('reads the run bottom up like the overview: first step last, queued work under NOW', () => {
    renderTree({ agents: [scout, implement, review, child(1)] });

    expect(rowIds()).toEqual(['agent-3', 'child-1', 'agent-2', 'agent-1']);
    expect(screen.getByText('Now')).toBeDefined();
    expect(within(rowOf('child-1')).getByText('2.1')).toBeDefined();
  });

  it('draws each node from the row state, the way the activity feed does', () => {
    renderTree();

    expect(within(rowOf('agent-1')).getByRole('img', { name: 'Done' })).toBeDefined();
    expect(within(rowOf('agent-2')).getByRole('img', { name: 'Running' }).className).toContain(
      'spin-border',
    );
    const queued = within(rowOf('agent-3')).getByRole('img', { name: 'Not started' });
    expect(queued.textContent).toBe('3');
  });

  it('puts children one column right of the run lane and dashes into queued work', () => {
    renderTree({ agents: [scout, implement, review, child(1)] });

    expect(
      rowOf('agent-2').querySelector('[data-rail-column]')?.getAttribute('data-rail-column'),
    ).toBe('0');
    expect(
      rowOf('child-1').querySelector('[data-rail-column]')?.getAttribute('data-rail-column'),
    ).toBe('1');
    const dashes = [...rowOf('agent-3').querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );
    expect(dashes).toContain('3 3');
  });

  it('opens the agent of the row that was clicked', () => {
    const onSelect = vi.fn();
    renderTree({ onSelect });

    fireEvent.click(screen.getByRole('button', { name: 'Step 2, Implement' }));

    expect(onSelect).toHaveBeenCalledWith(implement.id);
  });

  it('marks the selected row', () => {
    renderTree({ selectedAgentId: implement.id });

    expect(
      screen.getByRole('button', { name: 'Step 2, Implement' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('keeps the planned routing for a step that has not run yet', () => {
    renderTree();

    expect(metaOf('agent-1', 'model')).toBe('Sonnet 4.5');
    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('shows the model that actually ran and marks the plan it replaced', () => {
    useAppStore.setState({
      agentRunHistory: { [scout.id]: ['run-a' as ProviderRunId] },
      sessionTelemetry: {
        [SESSION_ID]: [
          {
            id: 'rec-1',
            runId: 'run-a' as ProviderRunId,
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
    renderTree();

    const ran = within(rowOf('agent-1')).getByTestId('routing-divergence');
    expect(ran.textContent).toBe(metaOf('agent-1', 'model'));
    expect(ran.textContent).not.toBe('Sonnet 4.5');
    expect(metaOf('agent-1', 'cost')).toBe('$0.10');
  });

  it('shows the provider the agent runs on instead of guessing it from the model id', () => {
    renderTree({ agentProviderOverride: { [implement.id]: 'cursor' } });

    const row = rowOf('agent-2').outerHTML;

    expect(row).toContain(brandColor('cursor'));
    expect(row).not.toContain(brandColor('codex'));
  });

  it('shows the planned effort next to the model of each step', () => {
    renderTree({ agentEffortOverride: { [implement.id]: 'low' } });

    expect(metaOf('agent-2', 'effort')).toBe('Low');
  });

  it('marks the agent that asked and offers Answer on that row only', () => {
    const onAnswer = vi.fn();
    const asked = question('oq-1', implement.id);
    renderTree({ questions: [asked], onAnswer });

    expect(
      within(rowOf('agent-2')).getByRole('img', { name: 'Waiting on your answer' }),
    ).toBeDefined();
    expect(within(rowOf('agent-2')).getByTestId('timeline-row-state').textContent).toBe(
      'Needs your answer',
    );
    const answers = screen.getAllByRole('button', { name: 'Answer' });
    expect(answers).toHaveLength(1);

    fireEvent.click(answers[0]!);

    expect(onAnswer).toHaveBeenCalledWith(asked);
  });

  it('shows the question on a nested row, not only on its step', () => {
    renderTree({
      agents: [scout, implement, review, child(1)],
      questions: [question('oq-1', 'child-1' as AgentId)],
    });

    expect(
      within(rowOf('child-1')).getByRole('img', { name: 'Waiting on your answer' }),
    ).toBeDefined();
    expect(within(rowOf('agent-2')).getByRole('img', { name: 'Running' })).toBeDefined();
  });

  it('says a delegate row answers for its step and keeps it out of the waiting state', () => {
    const delegate = child(1, {
      name: 'answer: pick a database',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
    });
    renderTree({
      agents: [scout, implement, review, delegate],
      questions: [question('oq-1', delegate.id)],
    });

    expect(within(rowOf('child-1')).getByText('answering for Implement')).toBeDefined();
    expect(screen.queryByRole('img', { name: 'Waiting on your answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('leaves an ordinary sub-agent row without an answering line', () => {
    renderTree({ agents: [scout, implement, review, child(1)] });

    expect(within(rowOf('child-1')).queryByText(/answering for/u)).toBeNull();
  });
});
