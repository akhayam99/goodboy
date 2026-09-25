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
import { resolveOrchestratorState } from './orchestratorState';

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
};

const resolve = ({
  run = makeRun(),
  agents = [],
  isOrchestrating = false,
  hasOpenQuestions = false,
  costUsd = 0,
}: ResolveParams = {}) =>
  resolveOrchestratorState({ run, agents, isOrchestrating, hasOpenQuestions, costUsd });

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

  it('reports a graceful pause while a step finishes with autorun off', () => {
    const state = resolve({ agents: [makeAgent(0, 'running')] });

    expect(state.phase).toBe('stopping-graceful');
    expect(state.tone).toBe('neutral');
    expect(state.sentence).toBe('Finishing the step in flight · autorun is off');
  });

  it('reports a normal pause after the graceful step finishes', () => {
    const state = resolve({ agents: [makeAgent(0, 'completed')] });

    expect(state.phase).toBe('ready-mid');
    expect(state.tone).toBe('neutral');
    expect(state.sentence).toBe('Paused · autorun is off');
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
      ['budget', 'paused-budget', true],
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

  it('ignores a question stop once the question is answered', () => {
    const state = resolve({
      run: makeRun({ orchestrationStop: { kind: 'questions', message: 'answer me' } }),
      agents: [makeAgent(0, 'completed')],
      hasOpenQuestions: false,
    });

    expect(state.phase).toBe('ready-mid');
    expect(state.sentence).toBe('Paused · autorun is off');
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

    expect(state.sentence).toBe('Step 1 stopped when Goodboy quit · step 0');
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
