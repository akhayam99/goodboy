// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestionId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

type Store = {
  sessionPhaseRuns: AppStore['sessionPhaseRuns'];
  sessionOpenQuestions: AppStore['sessionOpenQuestions'];
  agentTurnState: AppStore['agentTurnState'];
  transcripts: AppStore['transcripts'];
  summarizerStatus: AppStore['summarizerStatus'];
  recoverStuckStep: Mock<AppStore['recoverStuckStep']>;
  askAgentToContinue: Mock<AppStore['askAgentToContinue']>;
  skipStuckStepAndAdvance: Mock<AppStore['skipStuckStepAndAdvance']>;
  navigate: Mock<AppStore['navigate']>;
  loadAgentTranscript: Mock<AppStore['loadAgentTranscript']>;
  requestOpenQuestionScroll: Mock<AppStore['requestOpenQuestionScroll']>;
};

const store: Store = {
  sessionPhaseRuns: {},
  sessionOpenQuestions: {},
  agentTurnState: {},
  transcripts: {},
  summarizerStatus: {},
  recoverStuckStep: vi.fn<AppStore['recoverStuckStep']>(async () => undefined),
  askAgentToContinue: vi.fn<AppStore['askAgentToContinue']>(async () => undefined),
  skipStuckStepAndAdvance: vi.fn<AppStore['skipStuckStepAndAdvance']>(async () => undefined),
  navigate: vi.fn<AppStore['navigate']>(),
  loadAgentTranscript: vi.fn<AppStore['loadAgentTranscript']>(async () => undefined),
  requestOpenQuestionScroll: vi.fn<AppStore['requestOpenQuestionScroll']>(),
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

import { NextActionStrip } from './index';
import { QUESTION_DELEGATE_SOURCE_KIND } from '../../../context/questionDelegate';

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

const toneOf = (strip: HTMLElement): string | null =>
  within(strip).getByTestId('tone-bar').getAttribute('data-tone');

const renderStrip = ({
  subjectAgentId = null,
}: { readonly subjectAgentId?: AgentId | null } = {}) => {
  useAppStore.setState(store);
  return render(
    <NextActionStrip
      sessionId={SESSION_ID}
      run={run}
      workflow={workflow}
      subjectAgentId={subjectAgentId}
    />,
  );
};

beforeEach(async () => {
  await resetStoryStore();
  store.transcripts = {};
  store.askAgentToContinue.mockReset();
  store.askAgentToContinue.mockResolvedValue(undefined);
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

  it('names the failed step, the cause, and one primary way out on a danger line', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    renderStrip({ subjectAgentId: 'agent-1' as AgentId });

    const strip = screen.getByRole('region', { name: 'Next action: recover the step' });
    expect(toneOf(strip)).toBe('danger');
    expect(within(strip).getByText('Implement stopped before finishing.')).toBeDefined();
    expect(within(strip).getByText('Test waits on this step.')).toBeDefined();
    expect(within(strip).getByRole('button', { name: 'Ask it to continue' })).toBeDefined();
    within(strip).getByRole('button', { name: 'Skip' });
  });

  it('puts a blocked step on a warning line, never the danger one', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'blocked')] };
    renderStrip({ subjectAgentId: 'agent-1' as AgentId });

    const strip = screen.getByRole('region', { name: 'Next action: recover the step' });
    expect(toneOf(strip)).toBe('warning');
    expect(within(strip).getByRole('button', { name: 'Ask it to continue' })).toBeDefined();
  });

  it('draws nothing for a step you stopped', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'stopped')] };
    const { container } = renderStrip({ subjectAgentId: 'agent-1' as AgentId });

    expect(container.innerHTML).toBe('');
  });

  it('asks the failed agent to check its work without skipping it', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    renderStrip();

    fireEvent.click(screen.getByRole('button', { name: 'Ask it to continue' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Ask it to continue' }));

    screen.getByRole('button', { name: 'Asking' });
    expect(screen.getByRole('button', { name: 'Skip' }).hasAttribute('disabled')).toBe(true);
  });

  it('skips the step only after an explicit confirmation', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    renderStrip();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(store.skipStuckStepAndAdvance).not.toHaveBeenCalled();
    screen.getByText(/implement is marked skipped/i);

    fireEvent.click(screen.getByRole('button', { name: 'Skip step' }));

    expect(store.skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      onlyWhenBlocked: true,
    });
  });

  it('keeps the technical cause behind a disclosure', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'failed')] };
    store.agentTurnState = {
      ['agent-1' as AgentId]: {
        kind: 'error',
        message: 'codex exited with code 1',
        failedAt: NOW,
      },
    };
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

  it('leaves a step question to the asking row the run tree draws', () => {
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
    renderStrip();

    expect(screen.queryByRole('region', { name: 'Next action: answer' })).toBeNull();
  });

  it('sends Answer to the agent that asked when no tree row shows it, on a warning line', () => {
    const delegate: Agent = {
      ...agent(1, 'completed'),
      id: 'agent-1' as AgentId,
      stepId: undefined,
      parentAgentId: 'agent-0' as AgentId,
      sourceKind: QUESTION_DELEGATE_SOURCE_KIND,
    };
    store.sessionPhaseRuns = {
      [SESSION_ID]: [agent(0, 'completed'), delegate, agent(2, 'pending')],
    };
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
    expect(toneOf(strip)).toBe('warning');
    fireEvent.click(within(strip).getByRole('button', { name: 'Answer' }));

    expect(store.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: 'agent-1', pane: 'brief' },
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
    store.summarizerStatus = {
      [SESSION_ID]: {
        status: 'running',
        lastUpdate: null,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    };
    renderStrip();

    const strip = screen.getByRole('region', { name: 'Next action: waiting on the next brief' });
    expect(within(strip).getByText('Writing the next brief from Plan.')).toBeDefined();
    expect(within(strip).queryByRole('button')).toBeNull();
  });
});
