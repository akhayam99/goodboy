// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

type Store = {
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  sessionOpenQuestions: Record<string, ReadonlyArray<OpenQuestion>>;
  agentTurnState: Record<string, { kind: string; message?: string }>;
  summarizerStatus: Record<string, { status: string }>;
  recoverStuckStep: ReturnType<typeof vi.fn>;
  skipStuckStepAndAdvance: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  loadAgentTranscript: ReturnType<typeof vi.fn>;
  requestOpenQuestionScroll: ReturnType<typeof vi.fn>;
};

const { store } = vi.hoisted(() => ({
  store: {
    sessionPhaseRuns: {},
    sessionOpenQuestions: {},
    agentTurnState: {},
    summarizerStatus: {},
    recoverStuckStep: vi.fn(async () => undefined),
    skipStuckStepAndAdvance: vi.fn(async () => undefined),
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    requestOpenQuestionScroll: vi.fn(),
  } as Store,
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
  useSessionOpenQuestions: (sessionId: string) => store.sessionOpenQuestions[sessionId] ?? [],
}));

import { NextActionStrip } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Harden checkout',
  description: '',
  steps: ['Plan', 'Implement', 'Test'].map((name, ordinal) => ({
    id: `step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: '',
  })),
  createdAt: NOW,
  updatedAt: NOW,
};

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
};

const agent = (index: number, status: Agent['status']): Agent => ({
  id: `agent-${index}` as AgentId,
  sessionId: SESSION_ID,
  stepId: workflow.steps[index]!.id,
  workflowRunId: RUN_ID,
  ordinal: index,
  name: `${workflow.steps[index]!.name} agent`,
  status,
});

const renderStrip = ({
  subjectAgentId = null,
}: { readonly subjectAgentId?: AgentId | null } = {}) =>
  render(
    <NextActionStrip
      sessionId={SESSION_ID}
      run={run}
      workflow={workflow}
      subjectAgentId={subjectAgentId}
    />,
  );

beforeEach(() => {
  store.sessionPhaseRuns = {};
  store.sessionOpenQuestions = {};
  store.agentTurnState = {};
  store.summarizerStatus = {};
  store.recoverStuckStep.mockReset();
  store.recoverStuckStep.mockResolvedValue(undefined);
  store.skipStuckStepAndAdvance.mockReset();
  store.skipStuckStepAndAdvance.mockResolvedValue(undefined);
  store.navigate.mockReset();
  store.requestOpenQuestionScroll.mockReset();
  store.navigate.mockReset();
});

afterEach(cleanup);

describe('NextActionStrip', () => {
  it('renders nothing while the run moves on its own', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    const { container } = renderStrip();

    expect(container.innerHTML).toBe('');
  });

  it('names the failed step, the cause, and one primary way out on the danger rail', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    renderStrip({ subjectAgentId: 'agent-1' as AgentId });

    const strip = screen.getByRole('region', { name: 'Next action: recover the step' });
    expect(strip.className).toContain('border-l-danger');
    expect(strip.className).not.toContain('bg-danger');
    expect(within(strip).getByText('Implement stopped before finishing.')).toBeDefined();
    expect(within(strip).getByText('Test waits on this step.')).toBeDefined();
    expect(within(strip).getByRole('button', { name: 'Check completion' })).toBeDefined();
    expect(within(strip).getByRole('button', { name: 'Skip step' })).toBeDefined();
  });

  it('puts a blocked step on the warning rail, never the danger one', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'blocked')] };
    renderStrip({ subjectAgentId: 'agent-1' as AgentId });

    const strip = screen.getByRole('region', { name: 'Next action: recover the step' });
    expect(strip.className).toContain('border-l-warning');
    expect(strip.className).not.toContain('border-l-danger');
    expect(within(strip).getByRole('button', { name: 'Check completion' })).toBeDefined();
  });

  it('draws nothing for a step you stopped', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'stopped')] };
    const { container } = renderStrip({ subjectAgentId: 'agent-1' as AgentId });

    expect(container.innerHTML).toBe('');
  });

  it('asks the failed agent to check its work without skipping it', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    renderStrip();

    fireEvent.click(screen.getByRole('button', { name: 'Check completion' }));

    expect(store.recoverStuckStep).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
    });
    expect(store.skipStuckStepAndAdvance).not.toHaveBeenCalled();
  });

  it('shows progress and holds the skip while the check runs', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    store.recoverStuckStep.mockReturnValue(new Promise<void>(() => undefined));
    renderStrip();

    fireEvent.click(screen.getByRole('button', { name: 'Check completion' }));

    expect(screen.getByRole('button', { name: 'Checking step' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Skip step' }).hasAttribute('disabled')).toBe(true);
  });

  it('skips the step only after an explicit confirmation', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    renderStrip();

    fireEvent.click(screen.getByRole('button', { name: 'Skip step' }));
    expect(store.skipStuckStepAndAdvance).not.toHaveBeenCalled();
    expect(screen.getByText(/implement will be marked skipped/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Skip and continue' }));

    expect(store.skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      onlyWhenBlocked: true,
    });
  });

  it('keeps the technical cause behind a disclosure', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    store.agentTurnState = { 'agent-1': { kind: 'error', message: 'codex exited with code 1' } };
    renderStrip();

    expect(screen.queryByText('codex exited with code 1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));

    expect(screen.getByTestId('next-action-details').textContent).toBe('codex exited with code 1');
  });

  it('stays off an agent that is not the failed step', () => {
    store.sessionPhaseRuns = {
      [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed'), agent(2, 'pending')],
    };
    const { container } = renderStrip({ subjectAgentId: 'agent-0' as AgentId });

    expect(container.innerHTML).toBe('');
  });

  it('sends Answer to the agent that asked, on the warning rail', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'running')] };
    store.sessionOpenQuestions = {
      [SESSION_ID]: [
        {
          id: 'q-1' as OpenQuestionId,
          sessionId: SESSION_ID,
          workflowRunId: RUN_ID,
          createdByAgentId: 'agent-1' as AgentId,
          text: 'Keep the legacy export?',
          suggestedAnswers: [],
          isBlocking: true,
          userAnswer: null,
          status: 'open',
          createdAt: NOW,
        },
      ],
    };
    const listener = vi.fn();
    window.addEventListener('goodboy:reveal-chat', listener);
    renderStrip();

    const strip = screen.getByRole('region', { name: 'Next action: answer' });
    expect(strip.className).toContain('border-l-warning');
    fireEvent.click(within(strip).getByRole('button', { name: 'Answer' }));

    expect(store.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: 'agent-1' },
    });
    expect(store.requestOpenQuestionScroll).toHaveBeenCalledWith({
      agentId: 'agent-1',
      questionId: 'q-1',
    });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:reveal-chat', listener);
  });

  it('says whose handoff is being written, with nothing to click', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.summarizerStatus = { [SESSION_ID]: { status: 'running' } };
    renderStrip();

    const strip = screen.getByRole('region', { name: 'Next action: waiting on the next brief' });
    expect(within(strip).getByText('Writing the next brief from Plan.')).toBeDefined();
    expect(within(strip).queryByRole('button')).toBeNull();
  });
});
