import { describe, expect, it } from 'vitest';
import type { Agent, IsoDateTime, OpenQuestion, Step, WorkflowRun } from '@goodboy/types';
import type { WorkflowAdvanceState } from '../workflows/advanceGate';
import {
  isRowNeedingYou,
  resolveAgentRowState,
  resolveRunRowState,
  type RowState,
  type RowStateReason,
} from './rowState';
import {
  rowStateNode,
  rowStateSentence,
  rowStateShortSentence,
  rowStateTone,
} from './rowStateCopy';

const agentOf = (overrides: Partial<Agent> = {}): Agent =>
  ({
    id: 'agent-1',
    name: 'Implement',
    status: 'pending',
    ...overrides,
  }) as unknown as Agent;

const iso = (value: string): IsoDateTime => JSON.parse(JSON.stringify(value));

const QUESTION = { id: 'q-1', createdAt: '2026-09-24T10:00:00Z' } as unknown as OpenQuestion;

const STEP = { id: 'step-5', name: 'Review' } as unknown as Step;

const runOf = (overrides: Partial<WorkflowRun> = {}): WorkflowRun =>
  ({ id: 'run-1', autoRun: false, ...overrides }) as unknown as WorkflowRun;

type AgentCase = {
  readonly agent?: Partial<Agent>;
  readonly isAsking?: boolean;
  readonly isReadyStep?: boolean;
};

const agentState = ({ agent = {}, isAsking = false, isReadyStep = false }: AgentCase): RowState =>
  resolveAgentRowState({
    agent: agentOf(agent),
    isAsking,
    question: isAsking ? QUESTION : null,
    isReadyStep,
  });

type RunCase = Partial<Parameters<typeof resolveRunRowState>[0]> & {
  readonly runOverrides?: Partial<WorkflowRun>;
};

const runState = ({ runOverrides = {}, ...params }: RunCase): RowState =>
  resolveRunRowState({
    run: runOf(runOverrides),
    advance: null,
    isFinished: false,
    isDeciding: false,
    hasRunningStep: false,
    failedStep: null,
    question: null,
    readyStep: null,
    chainedAfterTitle: null,
    ...params,
  });

const blocked = (reason: 'questions' | 'summarizer' | 'failed-step' | 'turn-running') =>
  ({ kind: 'blocked', reason, step: STEP, failedStep: null }) satisfies WorkflowAdvanceState;

type Reading = {
  readonly node: string;
  readonly sentence: string | null;
  readonly tone: string;
  readonly ask: string | null;
};

const read = (state: RowState): Reading => ({
  node: rowStateNode({ state }).state,
  sentence: rowStateSentence({ state }),
  tone: rowStateTone({ state }),
  ask: state.ask?.kind ?? null,
});

describe('resolveAgentRowState', () => {
  it.each<[string, AgentCase, Reading]>([
    [
      'A1 queued',
      { agent: { stepId: STEP.id } },
      { node: 'queued', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'A1b opened by hand, no turn yet',
      {},
      { node: 'queued', sentence: 'Waiting for your first message', tone: 'neutral', ask: null },
    ],
    [
      'A1c resolver waiting in the resolve queue',
      { agent: { kind: 'resolver' } },
      { node: 'queued', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'A1d fan-out child',
      { agent: { parentAgentId: 'agent-0' as Agent['id'] } },
      { node: 'queued', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'A2 ready, autorun off',
      { isReadyStep: true },
      { node: 'ready', sentence: 'Ready to run', tone: 'warning', ask: null },
    ],
    [
      'A5 running',
      { agent: { status: 'running' } },
      { node: 'running', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'A6 open question',
      { agent: { status: 'running' }, isAsking: true },
      { node: 'question', sentence: 'Needs your answer', tone: 'warning', ask: 'answer' },
    ],
    [
      'A7 failed',
      { agent: { status: 'failed' } },
      { node: 'failed', sentence: 'Failed', tone: 'danger', ask: null },
    ],
    [
      'A10 done',
      { agent: { status: 'completed' } },
      { node: 'done', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'A12 closed by you',
      { agent: { status: 'failed', doneAt: iso('2026-09-24T11:00:00Z') } },
      { node: 'closed', sentence: 'Closed by you', tone: 'neutral', ask: null },
    ],
    [
      'A13 skipped',
      { agent: { status: 'skipped' } },
      { node: 'skipped', sentence: 'Skipped', tone: 'neutral', ask: null },
    ],
    [
      'A14 blocked, alive but stuck',
      { agent: { status: 'blocked' } },
      {
        node: 'approval',
        sentence: 'Blocked, tell the agent what to do next',
        tone: 'warning',
        ask: null,
      },
    ],
  ])('%s', (_name, input, expected) => {
    expect(read(agentState(input))).toEqual(expected);
  });

  it('puts failed above an open question on the same agent', () => {
    expect(agentState({ agent: { status: 'failed' }, isAsking: true }).phase).toBe('failed');
  });

  it('shows the open question of a blocked agent before the blocked reason', () => {
    expect(agentState({ agent: { status: 'blocked' }, isAsking: true }).reason?.kind).toBe(
      'question',
    );
  });

  it('keeps a finished agent done when you also closed it', () => {
    expect(
      agentState({ agent: { status: 'completed', doneAt: iso('2026-09-24T11:00:00Z') } }).phase,
    ).toBe('done');
  });
});

describe('resolveRunRowState', () => {
  it.each<[string, RunCase, Reading]>([
    [
      'R1 a step in flight',
      { hasRunningStep: true },
      { node: 'running', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'R2 the orchestrator decides',
      { isDeciding: true },
      { node: 'running', sentence: 'Choosing the next step', tone: 'neutral', ask: null },
    ],
    [
      'R3 the summarizer briefs the next step, the machine works',
      { advance: blocked('summarizer') },
      { node: 'running', sentence: 'Briefing the next step', tone: 'neutral', ask: null },
    ],
    [
      'R4 the chat turn runs, the machine works',
      { advance: blocked('turn-running') },
      {
        node: 'running',
        sentence: 'Waiting for the chat turn to finish',
        tone: 'neutral',
        ask: null,
      },
    ],
    [
      'R5 a step asks',
      { question: { question: QUESTION, stepLabel: '4.2' } },
      {
        node: 'question',
        sentence: 'Needs your answer in step 4.2',
        tone: 'warning',
        ask: 'answer',
      },
    ],
    [
      'R6 the next step waits for your click',
      {
        advance: { kind: 'ready', step: STEP },
        readyStep: { step: STEP, agent: agentOf(), stepLabel: '5' },
      },
      { node: 'ready', sentence: 'Step 5 is ready to run', tone: 'warning', ask: 'runStep' },
    ],
    [
      'R7 a step failed',
      { failedStep: { stepLabel: '4.1', isBlocked: false }, advance: blocked('failed-step') },
      { node: 'failed', sentence: 'Step 4.1 failed', tone: 'danger', ask: 'restartStep' },
    ],
    [
      'R7b a step is blocked, alive but stuck',
      { failedStep: { stepLabel: '4.1', isBlocked: true }, advance: blocked('failed-step') },
      {
        node: 'approval',
        sentence: 'Step 4.1 is blocked, tell the agent what to do next',
        tone: 'warning',
        ask: 'restartStep',
      },
    ],
    [
      'R8 the spend limit paused it',
      { runOverrides: { orchestrationStop: { kind: 'budget', message: 'cap' }, spendLimitUsd: 5 } },
      {
        node: 'budget',
        sentence: 'Paused at the $5.00 spend limit',
        tone: 'warning',
        ask: null,
      },
    ],
    [
      'R9 you stopped it',
      { runOverrides: { orchestrationStop: { kind: 'operator', message: 'stopped' } } },
      { node: 'stopped', sentence: 'Stopped by you', tone: 'neutral', ask: null },
    ],
    [
      'R10 the orchestrator failed',
      { runOverrides: { orchestrationStop: { kind: 'failure', message: 'boom' } } },
      { node: 'failed', sentence: 'The orchestrator failed', tone: 'danger', ask: null },
    ],
    [
      'R11 the orchestrator stopped on a question',
      { runOverrides: { orchestrationStop: { kind: 'questions', message: 'answer' } } },
      { node: 'question', sentence: 'Needs your answer', tone: 'warning', ask: 'answer' },
    ],
    [
      'R12 chained after another run',
      { chainedAfterTitle: 'Fix checkout' },
      { node: 'queued', sentence: 'Starts after Fix checkout', tone: 'neutral', ask: null },
    ],
    [
      'R13 complete',
      { isFinished: true },
      { node: 'done', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'R14 discarded keeps quiet, the discard event already says it',
      { runOverrides: { discardedAt: iso('2026-09-24T12:00:00Z') } },
      { node: 'closed', sentence: null, tone: 'neutral', ask: null },
    ],
    [
      'R15 closed by you wins over the failed step it leaves behind',
      {
        runOverrides: {
          orchestrationOutcome: 'done',
          orchestrationStop: { kind: 'closed', message: 'Closed by you' },
        },
        isFinished: true,
        failedStep: { stepLabel: '2', isBlocked: false },
      },
      { node: 'closed', sentence: 'Closed by you', tone: 'neutral', ask: null },
    ],
  ])('%s', (_name, input, expected) => {
    expect(read(runState(input))).toEqual(expected);
  });

  it('never says Needs you while the machine is the one working', () => {
    for (const reason of ['summarizer', 'turn-running'] as const) {
      expect(runState({ advance: blocked(reason) }).phase).toBe('running');
    }
  });

  it('orders failed over waiting over running', () => {
    expect(
      runState({
        failedStep: { stepLabel: '2', isBlocked: false },
        question: { question: QUESTION, stepLabel: '3' },
        hasRunningStep: true,
      }).phase,
    ).toBe('failed');
    expect(
      runState({ question: { question: QUESTION, stepLabel: '3' }, hasRunningStep: true }).phase,
    ).toBe('waiting');
    expect(
      runState({ question: { question: QUESTION, stepLabel: '3' }, isDeciding: true }).phase,
    ).toBe('waiting');
  });

  it('prefers the answer over the next click and the spend limit', () => {
    const state = runState({
      question: { question: QUESTION, stepLabel: '1' },
      advance: { kind: 'ready', step: STEP },
      runOverrides: { orchestrationStop: { kind: 'budget', message: 'cap' } },
    });

    expect(state.reason?.kind).toBe('question');
  });

  it('drops the chain sentence once the run it waits on has started its own work', () => {
    expect(runState({ chainedAfterTitle: 'Fix checkout', hasRunningStep: true }).reason).toBeNull();
  });
});

describe('rowStateNode', () => {
  it('names the deciding node the way the orchestrator panel words it', () => {
    expect(rowStateNode({ state: runState({ isDeciding: true }) }).label).toBe(
      'Choosing the next step',
    );
  });
});

describe('rowStateShortSentence', () => {
  const waiting = (reason: RowStateReason): RowState => ({ phase: 'waiting', reason, ask: null });

  it.each<[RowStateReason, string]>([
    [{ kind: 'question', stepLabel: '2' }, 'Needs you'],
    [{ kind: 'ready', stepLabel: '3' }, 'Step 3 ready'],
    [{ kind: 'budget', limitUsd: 12 }, 'At spend limit'],
    [{ kind: 'stepFailed', stepLabel: '4' }, 'Step 4 failed'],
    [{ kind: 'chained', afterTitle: 'Backfill the settled batches behind a flag' }, 'Chained'],
    [{ kind: 'deciding' }, 'Choosing next'],
    [{ kind: 'awaitingFirstMessage' }, 'Write to start'],
  ])('keeps %o readable in a narrow row as %s', (reason, short) => {
    expect(rowStateShortSentence({ state: waiting(reason) })).toBe(short);
  });

  it('has nothing to say when the full sentence has nothing to say', () => {
    expect(rowStateShortSentence({ state: { phase: 'done', reason: null, ask: null } })).toBeNull();
    expect(rowStateShortSentence({ state: waiting({ kind: 'discarded' }) })).toBeNull();
  });
});

describe('stopped agents', () => {
  it('reads a stopped agent as stopped by you with a Continue ask, never as failed', () => {
    const state = agentState({ agent: { status: 'stopped', stoppedBy: 'you' } });

    expect(read(state)).toEqual({
      node: 'stopped',
      sentence: 'Stopped by you',
      tone: 'neutral',
      ask: 'continue',
    });
    expect(isRowNeedingYou({ state })).toBe(false);
  });

  it('says Goodboy quit when the app stopped the agent', () => {
    const state = agentState({ agent: { status: 'stopped', stoppedBy: 'app' } });

    expect(rowStateSentence({ state })).toBe('Stopped when Goodboy quit');
    expect(rowStateNode({ state }).label).toBe('Stopped when Goodboy quit');
  });

  it('names the stopped step on the run and asks to continue it', () => {
    const agent = agentOf({ status: 'stopped', stoppedBy: 'you' });
    const state = runState({ stoppedStep: { agent, stepLabel: '4' } });

    expect(read(state)).toEqual({
      node: 'stopped',
      sentence: 'Step 4 stopped by you',
      tone: 'neutral',
      ask: 'continue',
    });
    expect(rowStateShortSentence({ state })).toBe('Stopped');
    expect(isRowNeedingYou({ state })).toBe(false);
  });

  it('puts a blocked step ahead of a stopped one and keeps it a warning', () => {
    const agent = agentOf({ status: 'stopped', stoppedBy: 'you' });
    const state = runState({
      failedStep: { stepLabel: '3', isBlocked: true },
      stoppedStep: { agent, stepLabel: '4' },
    });

    expect(state.reason?.kind).toBe('stepBlocked');
    expect(rowStateTone({ state })).toBe('warning');
    expect(rowStateNode({ state }).label).toBe('Blocked');
  });

  it('still counts an open question as needing you', () => {
    expect(isRowNeedingYou({ state: agentState({ isAsking: true }) })).toBe(true);
  });
});
