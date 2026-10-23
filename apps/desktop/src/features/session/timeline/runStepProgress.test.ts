// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TimelineRunEntry } from './buildTimelineGroups';
import type { WorkflowAdvanceState } from '../../workflows/advanceGate';
import { runStepCounts, runStepProgress, runStepStates } from './runStepProgress';

type EntryParams = {
  readonly statuses: ReadonlyArray<string>;
  readonly stepCount: number;
  readonly executionMode?: 'static' | 'dynamic';
};

const entryOf = ({
  statuses,
  stepCount,
  executionMode = 'static',
}: EntryParams): TimelineRunEntry =>
  JSON.parse(
    JSON.stringify({
      kind: 'run',
      run: { id: 'run-1', executionMode },
      workflow: {
        steps: Array.from({ length: stepCount }, (_, index) => ({ id: `step-${index}` })),
      },
      children: statuses.map((status, index) => ({
        kind: 'agent',
        agent: { id: `agent-${index}`, status },
      })),
    }),
  );

describe('runStepProgress', () => {
  it('names the step the run reached out of the planned steps', () => {
    expect(
      runStepProgress({ entry: entryOf({ statuses: ['completed', 'running'], stepCount: 4 }) }),
    ).toBe('Step 2 of 4');
  });

  it('counts the planned steps before anything starts', () => {
    expect(runStepProgress({ entry: entryOf({ statuses: ['pending'], stepCount: 3 }) })).toBe(
      '3 steps',
    );
  });

  it('gives an orchestrated run no total, because the next step is decided as it goes', () => {
    expect(
      runStepProgress({
        entry: entryOf({
          statuses: ['completed', 'completed', 'running'],
          stepCount: 0,
          executionMode: 'dynamic',
        }),
      }),
    ).toBe('Step 3');
  });

  it('says nothing for an orchestrated run that has not started', () => {
    expect(
      runStepProgress({
        entry: entryOf({ statuses: [], stepCount: 0, executionMode: 'dynamic' }),
      }),
    ).toBeNull();
  });
});

describe('runStepCounts', () => {
  it('counts the started steps and the planned total of a fixed run', () => {
    expect(
      runStepCounts({
        entry: entryOf({ statuses: ['completed', 'running', 'pending'], stepCount: 6 }),
      }),
    ).toEqual({ started: 2, total: 6 });
  });

  it('gives a dynamic run no total', () => {
    expect(
      runStepCounts({
        entry: entryOf({
          statuses: ['completed', 'running'],
          stepCount: 0,
          executionMode: 'dynamic',
        }),
      }),
    ).toEqual({ started: 2, total: null });
  });
});

type StatesEntryParams = {
  readonly agents: ReadonlyArray<{
    readonly stepId: string;
    readonly status: string;
    readonly hasQuestion?: boolean;
  }>;
  readonly stepCount: number;
};

const statesEntryOf = ({ agents, stepCount }: StatesEntryParams): TimelineRunEntry =>
  JSON.parse(
    JSON.stringify({
      kind: 'run',
      run: { id: 'run-1', executionMode: 'static' },
      workflow: {
        steps: Array.from({ length: stepCount }, (_, index) => ({
          id: `step-${index}`,
          deletedAt: index === stepCount - 1 && stepCount > 5 ? '2026-10-18T10:00:00Z' : undefined,
        })),
      },
      children: agents.map((agent, index) => ({
        kind: 'agent',
        agent: { id: `agent-${index}`, stepId: agent.stepId, status: agent.status },
        openQuestions: agent.hasQuestion === true ? [{ id: 'q-1' }] : [],
      })),
    }),
  );

const failedAdvance: WorkflowAdvanceState = JSON.parse(
  JSON.stringify({
    kind: 'blocked',
    reason: 'failed-step',
    step: { id: 'step-2' },
    failedStep: { id: 'step-2' },
  }),
);

describe('runStepStates', () => {
  it('reads running, waiting and not started from the step agents', () => {
    expect(
      runStepStates({
        entry: statesEntryOf({
          stepCount: 4,
          agents: [
            { stepId: 'step-0', status: 'completed' },
            { stepId: 'step-1', status: 'running' },
            { stepId: 'step-2', status: 'running', hasQuestion: true },
          ],
        }),
        advance: null,
      }),
    ).toEqual(['done', 'running', 'waiting', 'notStarted']);
  });

  it('marks the step the advance state failed', () => {
    expect(
      runStepStates({
        entry: statesEntryOf({
          stepCount: 3,
          agents: [
            { stepId: 'step-0', status: 'completed' },
            { stepId: 'step-1', status: 'completed' },
            { stepId: 'step-2', status: 'failed' },
          ],
        }),
        advance: failedAdvance,
      }),
    ).toEqual(['done', 'done', 'failed']);
  });

  it('marks the step an advance blocked on questions as waiting', () => {
    const questionAdvance: WorkflowAdvanceState = JSON.parse(
      JSON.stringify({
        kind: 'blocked',
        reason: 'questions',
        step: { id: 'step-1' },
        failedStep: null,
      }),
    );
    expect(
      runStepStates({
        entry: statesEntryOf({
          stepCount: 3,
          agents: [{ stepId: 'step-0', status: 'completed' }],
        }),
        advance: questionAdvance,
      }),
    ).toEqual(['done', 'waiting', 'notStarted']);
  });

  it('marks the step at a ready gate as waiting for your go', () => {
    const readyAdvance: WorkflowAdvanceState = JSON.parse(
      JSON.stringify({ kind: 'ready', step: { id: 'step-1' } }),
    );
    expect(
      runStepStates({
        entry: statesEntryOf({
          stepCount: 3,
          agents: [
            { stepId: 'step-0', status: 'completed' },
            { stepId: 'step-1', status: 'pending' },
          ],
        }),
        advance: readyAdvance,
      }),
    ).toEqual(['done', 'waiting', 'notStarted']);
  });

  it('leaves deleted steps out', () => {
    expect(
      runStepStates({ entry: statesEntryOf({ stepCount: 6, agents: [] }), advance: null }),
    ).toHaveLength(5);
  });
});
