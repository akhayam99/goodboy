// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowOrchestrationStop,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { resolveOrchestratorState, type PlanSignal } from './orchestratorState';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;

const makeRun = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

const makeAgent = (
  ordinal: number,
  status: Agent['status'],
  overrides: Partial<Agent> = {},
): Agent => ({
  id: `agent-${ordinal}` as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${ordinal}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: `step ${ordinal}`,
  status,
  ...overrides,
});

type ResolveParams = {
  readonly run?: WorkflowRun;
  readonly agents?: ReadonlyArray<Agent>;
  readonly isOrchestrating?: boolean;
  readonly hasOpenQuestions?: boolean;
  readonly costUsd?: number;
  readonly plan?: PlanSignal;
};

const resolve = ({
  run = makeRun(),
  agents = [],
  isOrchestrating = false,
  hasOpenQuestions = false,
  costUsd = 0,
  plan = { kind: 'none' },
}: ResolveParams = {}) =>
  resolveOrchestratorState({ run, agents, isOrchestrating, hasOpenQuestions, costUsd, plan });

describe('resolveOrchestratorState', () => {
  it('reports deciding while the orchestrator is choosing', () => {
    const state = resolve({ isOrchestrating: true });

    expect(state.phase).toBe('deciding');
    expect(state.tone).toBe('info');
    expect(state.sentence).toBe('Choosing the next step');
  });

  it('reports stopping when the user stops while a decision is in flight', () => {
    const state = resolve({
      run: makeRun({ orchestrationStop: { kind: 'operator', message: 'you stopped this run' } }),
      agents: [makeAgent(0, 'skipped')],
      isOrchestrating: true,
    });

    expect(state.phase).toBe('stopping');
    expect(state.tone).toBe('warning');
    expect(state.sentence).toBe('Stopping · waiting for the decision already in flight');
  });

  it('waits on the step in flight when the run asks before each step', () => {
    const running = makeAgent(0, 'running');
    const state = resolve({ agents: [running] });

    expect(state.phase).toBe('waiting');
    expect(state.sentence).toBe('Waiting on step 1 · step 0');
    expect(state.waitingOnAgentId).toBe(running.id);
  });

  it('waits for your go after a step when the run asks before each step', () => {
    const state = resolve({ agents: [makeAgent(0, 'completed')] });

    expect(state.phase).toBe('ready-mid');
    expect(state.tone).toBe('neutral');
    expect(state.sentence).toBe('Waiting for your go');
  });

  it('says the step in flight finishes when you pause, and nothing new starts', () => {
    const state = resolve({
      run: makeRun({ autoRun: true, orchestrationStop: { kind: 'paused', message: 'paused' } }),
      agents: [makeAgent(0, 'completed'), makeAgent(1, 'running', { name: 'Reviewer' })],
    });

    expect(state.phase).toBe('paused');
    expect(state.tone).toBe('warning');
    expect(state.sentence).toBe('Paused by you');
    expect(state.detail).toBe(
      'Reviewer finishes its turn. Nothing new starts until you resume. The pause survives a restart.',
    );
  });

  it('stays paused while a decision is in flight and names the next step', () => {
    const state = resolve({
      run: makeRun({ orchestrationStop: { kind: 'paused', message: 'paused' } }),
      agents: [makeAgent(0, 'completed'), makeAgent(1, 'pending', { name: 'Tester' })],
      isOrchestrating: true,
    });

    expect(state.phase).toBe('paused');
    expect(state.detail).toBe('Nothing new starts until you resume. Next: Tester.');
  });

  it('never claims the run is stopped before the decision returns', () => {
    const stopped = resolve({
      run: makeRun({ orchestrationStop: { kind: 'operator', message: 'you stopped this run' } }),
      isOrchestrating: false,
    });
    const stopping = resolve({
      run: makeRun({ orchestrationStop: { kind: 'operator', message: 'you stopped this run' } }),
      isOrchestrating: true,
    });

    expect(stopped.phase).toBe('stopped');
    expect(stopping.phase).not.toBe('stopped');
    expect(stopping.detail).toBeNull();
  });

  it('keeps deciding for stops the orchestrator raises about itself', () => {
    const state = resolve({
      run: makeRun({ orchestrationStop: { kind: 'failure', message: 'provider refused' } }),
      isOrchestrating: true,
    });

    expect(state.phase).toBe('deciding');
  });

  it('reports done with the step count and the run cost', () => {
    const state = resolve({
      run: makeRun({ orchestrationOutcome: 'done' }),
      agents: [makeAgent(0, 'completed'), makeAgent(1, 'completed')],
      costUsd: 1.5,
    });

    expect(state.phase).toBe('done');
    expect(state.tone).toBe('success');
    expect(state.sentence).toContain('2 steps');
  });

  it('reads a run the user closed as closed, never as complete', () => {
    const state = resolve({
      run: makeRun({
        orchestrationOutcome: 'done',
        orchestrationStop: { kind: 'closed', message: 'Closed by you' },
      }),
      agents: [makeAgent(0, 'completed'), makeAgent(1, 'skipped')],
      costUsd: 1.5,
    });

    expect(state.phase).toBe('done');
    expect(state.tone).toBe('neutral');
    expect(state.sentence).toMatch(/^Closed by you · 2 steps/);
  });

  it('reports blocked and leaves its reason to the decisions under the goal', () => {
    const state = resolve({
      run: makeRun({ orchestrationOutcome: 'blocked', orchestrationReason: 'needs a decision' }),
    });

    expect(state.phase).toBe('blocked');
    expect(state.tone).toBe('warning');
    expect(state.detail).toBeNull();
  });

  it('maps every stop kind to its presentation', () => {
    const kinds: ReadonlyArray<[WorkflowOrchestrationStop['kind'], string, boolean]> = [
      ['budget', 'paused-budget', false],
      ['failure', 'failed', true],
      ['questions', 'needs-answer', false],
      ['operator', 'stopped', true],
    ];

    const resolved = kinds.map(([kind]) =>
      resolve({
        run: makeRun({ orchestrationStop: { kind, message: 'stop message' } }),
        hasOpenQuestions: kind === 'questions',
      }),
    );

    expect(resolved.map((state) => state.phase)).toEqual(kinds.map(([, phase]) => phase));
    expect(resolved.map((state) => state.detail !== null)).toEqual(
      kinds.map(([, , showsMessage]) => showsMessage),
    );
  });

  it('reads a spend cap stop in its own words', () => {
    const state = resolve({
      run: makeRun({
        orchestrationStop: {
          kind: 'budget',
          message: 'Paused at the $10.00 spend cap for this session.',
        },
      }),
    });

    expect(state.sentence).toBe('Paused at the $10.00 spend cap for this session.');
    expect(state.detail).toBeNull();
  });

  it('ignores a question stop once the question is answered', () => {
    const state = resolve({
      run: makeRun({ orchestrationStop: { kind: 'questions', message: 'answer me' } }),
      agents: [makeAgent(0, 'completed')],
      hasOpenQuestions: false,
    });

    expect(state.phase).toBe('ready-mid');
    expect(state.sentence).toBe('Waiting for your go');
  });

  it('waits on the running step and names it for its measured time', () => {
    const running = makeAgent(1, 'running');
    const state = resolve({
      run: makeRun({ autoRun: true }),
      agents: [makeAgent(0, 'completed'), running],
    });

    expect(state.phase).toBe('waiting');
    expect(state.sentence).toBe('Waiting on step 2 · step 1');
    expect(state.waitingOnAgentId).toBe(running.id);
  });

  it('asks for an answer when a question is open and nothing runs', () => {
    const state = resolve({ agents: [makeAgent(0, 'completed')], hasOpenQuestions: true });

    expect(state.phase).toBe('needs-answer');
    expect(state.tone).toBe('neutral');
  });

  it('reports a failed step ahead of a pending one', () => {
    const state = resolve({ agents: [makeAgent(0, 'failed'), makeAgent(1, 'pending')] });

    expect(state.phase).toBe('step-failed');
    expect(state.tone).toBe('neutral');
    expect(state.sentence).toBe('Paused on failed step 1');
    expect(state.detail).toBeNull();
  });

  it('names a blocked step apart from a failed one', () => {
    const state = resolve({ agents: [makeAgent(0, 'completed'), makeAgent(1, 'blocked')] });

    expect(state.phase).toBe('step-failed');
    expect(state.sentence).toBe('Paused on blocked step 2');
  });

  it('holds calmly on a step you stopped, even under autorun', () => {
    const state = resolve({
      run: makeRun({ autoRun: true }),
      agents: [makeAgent(0, 'completed'), makeAgent(1, 'stopped', { stoppedBy: 'you' })],
    });

    expect(state.phase).toBe('waiting');
    expect(state.tone).toBe('neutral');
    expect(state.sentence).toBe('Step 2 stopped by you · step 1');
  });

  it('says when Goodboy stopped a step on quit', () => {
    const state = resolve({
      agents: [makeAgent(0, 'stopped', { stoppedBy: 'app' })],
    });

    expect(state.sentence).toBe('Step 1 stopped by restart · step 0');
  });

  it('waits on a pending step without a running agent', () => {
    const state = resolve({ agents: [makeAgent(0, 'completed'), makeAgent(1, 'pending')] });

    expect(state.phase).toBe('waiting');
    expect(state.sentence).toBe('Waiting on step 2 · step 1');
    expect(state.waitingOnAgentId).toBeNull();
  });

  it('continues automatically when autorun drives an idle run', () => {
    const state = resolve({
      run: makeRun({ autoRun: true }),
      agents: [makeAgent(0, 'completed')],
    });

    expect(state.phase).toBe('automatic');
    expect(state.sentence).toBe('Continuing automatically');
  });

  it('offers the first step when the run has no agents', () => {
    const state = resolve();

    expect(state.phase).toBe('ready-first');
    expect(state.sentence).toBe('Ready to plan the first step');
  });

  it('sorts agents by ordinal before numbering the steps', () => {
    const state = resolve({
      agents: [makeAgent(2, 'pending'), makeAgent(0, 'completed'), makeAgent(1, 'completed')],
    });

    expect(state.sentence).toBe('Waiting on step 3 · step 2');
  });
});

describe('resolveOrchestratorState while the run waits on its plan', () => {
  const held = () =>
    makeRun({
      orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
    });

  it('reads the plan stop as ready and waiting for you while the planner is quiet', () => {
    const state = resolve({ run: held(), agents: [makeAgent(0, 'completed')] });

    expect(state.phase).toBe('plan-approval');
    expect(state.sentence).toBe('Plan ready · waiting for you');
  });

  it('says the planner is revising, ahead of the plan stop', () => {
    const state = resolve({
      run: held(),
      agents: [makeAgent(0, 'completed')],
      plan: { kind: 'revising' },
    });

    expect(state.phase).toBe('plan-revising');
    expect(state.tone).toBe('info');
    expect(state.sentence).toBe('The planner is revising the plan');
  });

  it('says what the planner asked, ahead of the plan stop', () => {
    const state = resolve({
      run: held(),
      agents: [makeAgent(0, 'completed')],
      plan: { kind: 'question', question: { text: 'Keep the retry window at 5 minutes?' } },
    });

    expect(state.phase).toBe('plan-question');
    expect(state.tone).toBe('warning');
    expect(state.sentence).toBe('The planner asked: Keep the retry window at 5 minutes?');
  });

  it('keeps a long question on one line of the strip', () => {
    const state = resolve({
      run: held(),
      plan: { kind: 'question', question: { text: 'Keep the window\n\nat   5 minutes?\n' } },
    });

    expect(state.sentence).toBe('The planner asked: Keep the window at 5 minutes?');
  });

  it('wins over the stop presentation the held run would otherwise show', () => {
    const plain = resolve({ run: held() });
    const revising = resolve({ run: held(), plan: { kind: 'revising' } });
    const asking = resolve({
      run: held(),
      plan: { kind: 'question', question: { text: 'Which table?' } },
    });

    expect(plain.phase).toBe('plan-approval');
    expect([revising.phase, asking.phase]).toEqual(['plan-revising', 'plan-question']);
  });

  it('leaves a run that is not held for its plan to its own phase', () => {
    const state = resolve({
      agents: [makeAgent(0, 'running')],
      plan: { kind: 'revising' },
    });

    expect(state.phase).toBe('waiting');
  });

  it('lets a pause or a decision in flight speak first', () => {
    const paused = resolve({
      run: makeRun({ orchestrationStop: { kind: 'paused', message: 'Paused by you.' } }),
      plan: { kind: 'revising' },
    });
    const deciding = resolve({ run: held(), isOrchestrating: true, plan: { kind: 'revising' } });

    expect(paused.phase).toBe('paused');
    expect(deciding.phase).toBe('deciding');
  });
});
