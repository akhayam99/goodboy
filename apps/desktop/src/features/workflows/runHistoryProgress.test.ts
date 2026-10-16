import { describe, expect, it } from 'vitest';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import { runHistoryProgress } from './runHistoryProgress';
import { aRunHistoryRow } from './testing/aRunHistoryRow';

type Overrides = Partial<
  Omit<WorkflowRunHistoryRow, 'workflowRunId' | 'workflowId' | 'sessionId' | 'createdAt'>
>;

const runOf = (overrides: Overrides) => aRunHistoryRow({ overrides });

describe('runHistoryProgress', () => {
  it('counts started steps against the recipe, or alone for an orchestrated run', () => {
    expect(runHistoryProgress({ run: runOf({ startedSteps: 2 }) })).toBe('Step 2 of 3');
    expect(runHistoryProgress({ run: runOf({ startedSteps: 4 }) })).toBe('Step 3 of 3');
    expect(runHistoryProgress({ run: runOf({ executionMode: 'dynamic', startedSteps: 4 }) })).toBe(
      'Step 4',
    );
    expect(runHistoryProgress({ run: runOf({}) })).toBe('');
  });
});
