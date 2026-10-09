// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { WORK_META_COLUMN } from '@goodboy/ui';
import { carriesSpec } from '../../../../test/classTokens';
import { brandColor } from '../../../providers/components/provider-brand';
import { useAppStore } from '../../../../store';
import { RunTree } from './index';
import { useRunTree } from './useRunTree';

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
      role: 'planner',
      modelOverride: 'claude-sonnet-4-5',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      promptPrefix: '',
      role: 'implementer',
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
  readonly highlightedStepId?: string | null;
  readonly onHighlight?: (stepId: string | null) => void;
  readonly guidanceRun?: WorkflowRun | null;
};

type HarnessProps = {
  readonly selectedAgentId: AgentId | null;
  readonly highlightedStepId: string | null;
  readonly onHighlight: (stepId: string | null) => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
  readonly guidanceRun: WorkflowRun | null;
};

const Harness = ({
  selectedAgentId,
  highlightedStepId,
  onHighlight,
  onSelect,
  onAnswer,
  guidanceRun,
}: HarnessProps) => {
  const tree = useRunTree({ session, run, workflow, agentKindOverride: {} });
  return (
    <RunTree
      sessionId={SESSION_ID}
      runId={run.id}
      tree={tree}
      routing={{
        stepById: new Map(workflow.steps.map((step) => [step.id, step])),
        roleModels: null,
        sessionProvider: null,
        sessionEffort: null,
        run: guidanceRun,
      }}
      selectedAgentId={selectedAgentId}
      highlightedStepId={highlightedStepId}
      onHighlight={onHighlight}
      onSelect={onSelect}
      onAnswer={onAnswer}
    />
  );
};

const renderTree = ({
  agents = [scout, implement, review],
  questions = [],
  agentProviderOverride = {},
  agentEffortOverride = {},
  selectedAgentId = null,
  onSelect = vi.fn(),
  onAnswer = vi.fn(),
  highlightedStepId = null,
  onHighlight = vi.fn(),
  guidanceRun = null,
}: RenderParams = {}) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [...questions] },
    agentProviderOverride,
    agentEffortOverride,
  });
  render(
    <Harness
      selectedAgentId={selectedAgentId}
      highlightedStepId={highlightedStepId}
      onHighlight={onHighlight}
      onSelect={onSelect}
      onAnswer={onAnswer}
      guidanceRun={guidanceRun}
    />,
  );
};

const rowOf = (id: string): HTMLElement => screen.getByTestId(`run-tree-row-${id}`);

const META_SELECTOR = {
  model: '[data-meta-column="model"] [data-routing-part="name"]',
  effort: '[data-meta-column="model"] [data-routing-part="detail"]',
  cost: '[data-meta-column="cost"]',
} as const;

const metaOf = (id: string, column: keyof typeof META_SELECTOR): string | null =>
  rowOf(id).querySelector(META_SELECTOR[column])?.textContent ?? null;

const glyphOf = (id: string): HTMLElement => within(rowOf(id)).getByTestId('role-glyph');

const cardAfterRest = ({ element }: { readonly element: HTMLElement }): string => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(element);
  act(() => {
    vi.advanceTimersByTime(800);
  });
  vi.useRealTimers();
  const text = screen.getByRole('tooltip').textContent ?? '';
  fireEvent.mouseLeave(element);
  return text;
};

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
  it('reads the run in execution order: first step first, queued work last', () => {
    renderTree({ agents: [scout, implement, review, child(1)] });

    expect(rowIds()).toEqual(['agent-1', 'agent-2', 'child-1', 'agent-3']);
    expect(screen.queryByText('Now')).toBeNull();
    expect(within(rowOf('child-1')).getByText('2.1')).toBeDefined();
  });

  it('draws each node from the row state, the way the activity feed does', () => {
    renderTree();

    expect(within(rowOf('agent-1')).getByRole('img', { name: 'Done' })).toBeDefined();
    expect(within(rowOf('agent-2')).getByRole('img', { name: 'Running' }).className).toContain(
      'spin-border',
    );
    const queued = within(rowOf('agent-3')).getByRole('img', { name: 'Not started' });
    expect(queued.textContent).toBe('');
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

    expect(metaOf('agent-1', 'model')).not.toBe('Sonnet 4.5');
    expect(metaOf('agent-1', 'cost')).toBe('$0.10');
    expect(cardAfterRest({ element: glyphOf('agent-1') })).toContain('Planned');
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

    expect(within(rowOf('agent-2')).getByRole('img', { name: 'Needs you' })).toBeDefined();
    expect(within(rowOf('agent-2')).getByTestId('timeline-row-state').getAttribute('title')).toBe(
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

    expect(within(rowOf('child-1')).getByRole('img', { name: 'Needs you' })).toBeDefined();
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
    expect(screen.queryByRole('img', { name: 'Needs you' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('leaves an ordinary sub-agent row without an answering line', () => {
    renderTree({ agents: [scout, implement, review, child(1)] });

    expect(within(rowOf('child-1')).queryByText(/answering for/u)).toBeNull();
  });

  it('lights the step a decision explains, and reports hover on step rows only', () => {
    const onHighlight = vi.fn();
    renderTree({
      agents: [scout, implement, review, child(1)],
      highlightedStepId: 'step-2',
      onHighlight,
    });

    expect(rowOf('agent-2').dataset.highlighted).toBe('true');
    expect(rowOf('agent-1').dataset.highlighted).toBe('false');
    expect(rowOf('child-1').dataset.highlighted).toBe('false');

    fireEvent.mouseEnter(rowOf('agent-3'));
    expect(onHighlight).toHaveBeenLastCalledWith('step-3');
    fireEvent.mouseLeave(rowOf('agent-3'));
    expect(onHighlight).toHaveBeenLastCalledWith(null);

    onHighlight.mockClear();
    fireEvent.mouseEnter(rowOf('child-1'));
    expect(onHighlight).not.toHaveBeenCalled();
  });
});

describe('RunTree step row grammar', () => {
  it('draws the role as an icon with a name and prints no role word', () => {
    renderTree();
    const row = rowOf('agent-2');

    expect(within(row).getByRole('img', { name: 'Implementer' })).toBe(glyphOf('agent-2'));
    expect(within(row).queryByText('Implementer')).toBeNull();
    expect(within(rowOf('agent-1')).getByRole('img', { name: /^Scout/u })).toBeDefined();
  });

  it('puts the model and the effort on the right, before the time and the cost', () => {
    renderTree({ agentEffortOverride: { [implement.id]: 'low' } });
    const columns = [
      ...rowOf('agent-2').querySelectorAll(
        '[data-meta-column="model"], [data-meta-column="stack"]',
      ),
    ].map((column) => column.getAttribute('data-meta-column'));

    expect(columns).toEqual(['model', 'stack']);
    expect(
      carriesSpec({
        element: rowOf('agent-2').querySelector('[data-meta-column="model"]'),
        spec: WORK_META_COLUMN.model,
      }),
    ).toBe(true);
    expect(
      carriesSpec({
        element: rowOf('agent-2').querySelector('[data-meta-column="stack"]'),
        spec: WORK_META_COLUMN.stack,
      }),
    ).toBe(true);
    expect(metaOf('agent-2', 'model')).toBe('GPT 5.1 Codex');
    expect(metaOf('agent-2', 'effort')).toBe('Low');
  });

  it('opens the same identity card as the activity feed once the pointer rests on the icon', () => {
    renderTree();

    const card = cardAfterRest({ element: glyphOf('agent-2') });

    expect(card).toContain('Implementer');
    expect(card).toContain('Step 2 of 3');
  });

  it('opens the models card from the model on the right', () => {
    renderTree();
    const model = rowOf('agent-2').querySelector<HTMLElement>('[data-meta-column="model"]');
    if (model === null) {
      throw new Error('no model cell');
    }

    expect(cardAfterRest({ element: model })).toContain('Models, in run order');
  });

  it('opens the identity card when the row takes keyboard focus, and closes it on blur', () => {
    renderTree();
    const button = screen.getByRole('button', { name: 'Step 2, Implement' });
    vi.useFakeTimers();

    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.focus(button);
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Implementer');

    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('keeps a click on the icon or the model opening the step', () => {
    const onSelect = vi.fn();
    renderTree({ onSelect });

    fireEvent.click(glyphOf('agent-2'));
    fireEvent.click(rowOf('agent-2').querySelector('[data-meta-column="model"]')!);

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith(implement.id);
  });

  it('opens the card with i on the focused row', () => {
    renderTree();
    const button = screen.getByRole('button', { name: 'Step 2, Implement' });

    fireEvent.keyDown(button, { key: 'i' });
    expect(screen.getByRole('tooltip').textContent).toContain('Implementer');

    fireEvent.keyDown(button, { key: 'i' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('RunTree standing guidance', () => {
  const GUIDANCE = '- Group the commits by concern at the end.\n- Open the PR as a draft.';
  const withRules = (executionMode: WorkflowRun['executionMode']): WorkflowRun => ({
    ...run,
    executionMode,
    rulesSnapshot: {
      autonomy: 'step',
      spendLimitUsd: null,
      spendLimitMode: 'pause',
      spreadByHeadroom: false,
      standingGuidance: GUIDANCE,
      guidanceRoles: ['implementer'],
    },
  });
  const tagOf = (id: string): HTMLElement | null =>
    within(rowOf(id)).queryByLabelText(/^Guidance:/u);

  it('tags the step whose role got the guidance, quoting its first line', () => {
    renderTree({ guidanceRun: withRules('static') });

    expect(tagOf(implement.id)?.getAttribute('aria-label')).toBe(
      'Guidance: \u201cGroup the commits by concern at the end.\u201d, and 1 more',
    );
    expect(tagOf(implement.id)?.textContent).toBe('Guidance');
    expect(tagOf(scout.id)).toBeNull();
    expect(tagOf(review.id)).toBeNull();
  });

  it('tags no step of an orchestrated run', () => {
    renderTree({ guidanceRun: withRules('dynamic') });

    expect(screen.queryAllByLabelText(/^Guidance:/u)).toEqual([]);
  });
});
