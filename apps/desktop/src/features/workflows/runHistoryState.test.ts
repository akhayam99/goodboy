import { describe, expect, it } from 'vitest';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import { runHistoryState } from './runHistoryState';
import { aRunHistoryRow } from './testing/aRunHistoryRow';

type Overrides = Partial<
  Omit<WorkflowRunHistoryRow, 'workflowRunId' | 'workflowId' | 'sessionId' | 'createdAt'>
>;

const runOf = (overrides: Overrides) => aRunHistoryRow({ overrides });

const DYNAMIC: Overrides = {
  executionMode: 'dynamic',
  stepCount: 0,
  startedSteps: 4,
  finishedSteps: 4,
};

describe('runHistoryState', () => {
  it('reads running before failed, failed before done', () => {
    expect(
      runHistoryState({ run: runOf({ startedSteps: 3, runningSteps: 1, failedSteps: 1 }) }).key,
    ).toBe('running');
    expect(runHistoryState({ run: runOf({ startedSteps: 2, failedSteps: 1 }) }).key).toBe('failed');
    expect(runHistoryState({ run: runOf({ startedSteps: 3, finishedSteps: 3 }) }).key).toBe('done');
  });

  it('calls an orchestrated run done only on its done outcome', () => {
    expect(runHistoryState({ run: runOf(DYNAMIC) }).key).toBe('waiting');
    expect(runHistoryState({ run: runOf({ ...DYNAMIC, orchestrationOutcome: 'done' }) }).key).toBe(
      'done',
    );
    expect(
      runHistoryState({ run: runOf({ ...DYNAMIC, orchestrationOutcome: 'blocked' }) }).key,
    ).toBe('failed');
  });

  it('names a stopped, an idle and a never started run', () => {
    expect(runHistoryState({ run: runOf({ startedSteps: 1, stoppedSteps: 1 }) }).label).toBe(
      'Stopped',
    );
    expect(runHistoryState({ run: runOf({ startedSteps: 1, finishedSteps: 1 }) }).label).toBe(
      'Waiting for you',
    );
    expect(runHistoryState({ run: runOf({}) }).label).toBe('Not started');
  });
});
