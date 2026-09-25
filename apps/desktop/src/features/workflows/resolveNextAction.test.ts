import { describe, expect, it } from 'vitest';
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
import { resolveWorkflowAdvance } from './advanceGate';
import { resolveNextAction } from './resolveNextAction';

const WF_ID = 'wf-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const SESSION_ID = 'ses-1' as SessionId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const STEP_NAMES = ['Plan', 'Implement', 'Test', 'Review', 'Ship'] as const;

const workflowWith = ({ count }: { readonly count: number }): Workflow => ({
  id: WF_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  name: 'Refactor',
  description: '',
  steps: STEP_NAMES.slice(0, count).map((name, ordinal) => ({
    id: `s${ordinal}` as StepId,
    workflowId: WF_ID,
    ordinal,
    name,
    promptPrefix: '',
  })),
  createdAt: NOW,
  updatedAt: NOW,
});

const workflow = workflowWith({ count: 4 });

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WF_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
};

const stepAgents = (...statuses: ReadonlyArray<Agent['status']>): ReadonlyArray<Agent> =>
  statuses.map((status, index) => ({
    id: `a-${index}` as AgentId,
    sessionId: SESSION_ID,
    stepId: `s${index}` as StepId,
    workflowRunId: RUN_ID,
    ordinal: index,
    name: `${STEP_NAMES[index]} agent`,
    status,
  }));

const question = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: 'q-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  createdByAgentId: 'a-1' as AgentId,
  text: 'Keep the legacy validateCart export?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
  ...overrides,
});

type ResolveParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly subjectAgentId?: AgentId | null;
  readonly runOverride?: WorkflowRun;
  readonly workflowOverride?: Workflow;
  readonly isSummarizerRunning?: boolean;
};

const resolve = ({
  agents,
  questions = [],
  subjectAgentId = null,
  runOverride = run,
  workflowOverride = workflow,
  isSummarizerRunning = false,
}: ResolveParams) =>
  resolveNextAction({
    advance: resolveWorkflowAdvance({
      workflow: workflowOverride,
      agents,
      hasOpenQuestions: questions.length > 0,
      isSummarizerRunning,
      isTurnRunning: false,
      isAutoRun: runOverride.autoRun === true,
    }),
    run: runOverride,
    workflow: workflowOverride,
    agents,
    questions,
    subjectAgentId,
  });

describe('resolveNextAction', () => {
  it('has nothing to offer while the run moves normally', () => {
    expect(resolve({ agents: stepAgents('completed', 'pending') })).toEqual({ kind: 'none' });
  });

  it('names the failed step and the steps that wait on it', () => {
    const action = resolve({ agents: stepAgents('completed', 'failed', 'pending', 'pending') });

    expect(action).toMatchObject({
      kind: 'recover',
      subjectAgentId: 'a-1',
      step: { id: 's1' },
      sentence: 'Implement stopped before finishing.',
      cause: 'Test and Review wait on this step.',
    });
  });

  it('counts the waiting steps past the first two', () => {
    const wide = workflowWith({ count: 5 });
    const action = resolve({
      agents: stepAgents('failed', 'pending', 'pending', 'pending', 'pending'),
      workflowOverride: wide,
    });

    expect(action).toMatchObject({ cause: 'Implement, Test and 2 more wait on this step.' });
  });

  it('says the run ends on the last step', () => {
    const action = resolve({ agents: stepAgents('completed', 'completed', 'completed', 'failed') });

    expect(action).toMatchObject({ cause: 'The run finishes once this step is done.' });
  });

  it('keeps the recovery under autorun, because autorun stops on a failed step', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      runOverride: { ...run, autoRun: true },
    });

    expect(action.kind).toBe('recover');
  });

  it('covers an orchestrated run with the same recovery', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      runOverride: { ...run, executionMode: 'dynamic' },
    });

    expect(action).toMatchObject({
      kind: 'recover',
      cause: 'Nothing advances until this step is checked or skipped.',
    });
  });

  it('shows the recovery on the failed agent only', () => {
    const agents = stepAgents('completed', 'failed', 'pending');

    expect(resolve({ agents, subjectAgentId: 'a-1' as AgentId }).kind).toBe('recover');
    expect(resolve({ agents, subjectAgentId: 'a-0' as AgentId })).toEqual({ kind: 'none' });
    expect(resolve({ agents, subjectAgentId: 'a-2' as AgentId })).toEqual({ kind: 'none' });
  });

  it('puts an open question before a failed step in the run scope', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      questions: [question()],
    });

    expect(action).toMatchObject({
      kind: 'answer',
      subjectAgentId: 'a-1',
      sentence: 'Implement agent asks: Keep the legacy validateCart export?',
      cause: 'This step waits on your answer.',
    });
  });

  it('names the waiting step when another agent asks', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      questions: [question({ createdByAgentId: 'a-0' as AgentId })],
    });

    expect(action).toMatchObject({
      kind: 'answer',
      cause: 'Implement waits on your answer.',
    });
  });

  it('keeps an agent scope on the recovery even while a question is open', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      questions: [question()],
      subjectAgentId: 'a-1' as AgentId,
    });

    expect(action.kind).toBe('recover');
  });

  it('says how many questions are open when there is more than one', () => {
    const action = resolve({
      agents: stepAgents('completed', 'running'),
      questions: [question(), question({ id: 'q-2' as OpenQuestionId })],
    });

    expect(action).toMatchObject({
      cause: 'This step waits on your answer. 2 questions are open.',
    });
  });

  it('asks for an answer between orchestrated steps, when every step has settled', () => {
    const action = resolve({
      agents: stepAgents('completed', 'completed', 'completed', 'completed'),
      questions: [question({ createdByAgentId: undefined })],
      runOverride: { ...run, executionMode: 'dynamic' },
    });

    expect(action).toMatchObject({
      kind: 'answer',
      subjectAgentId: null,
      sentence: 'An agent asks: Keep the legacy validateCart export?',
      cause: 'The orchestrator waits on your answer.',
    });
  });

  it('drops a leftover question once a static run is complete', () => {
    const action = resolve({
      agents: stepAgents('completed', 'completed', 'completed', 'completed'),
      questions: [question()],
    });

    expect(action).toEqual({ kind: 'none' });
  });

  it('says whose handoff is being written while the summarizer holds the run', () => {
    const action = resolve({
      agents: stepAgents('completed', 'pending'),
      isSummarizerRunning: true,
    });

    expect(action).toEqual({
      kind: 'summarizing',
      subjectAgentId: null,
      sentence: 'Writing the next brief from Plan.',
      cause: 'Implement starts from it once it is ready.',
    });
  });

  it('offers nothing on a run the user closed, failed step included', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      runOverride: {
        ...run,
        orchestrationOutcome: 'done',
        orchestrationStop: { kind: 'closed', message: 'Closed by you' },
      },
    });

    expect(action).toEqual({ kind: 'none' });
  });

  it('offers nothing on a discarded run', () => {
    const action = resolve({
      agents: stepAgents('completed', 'failed'),
      runOverride: { ...run, discardedAt: NOW },
    });

    expect(action).toEqual({ kind: 'none' });
  });
});
