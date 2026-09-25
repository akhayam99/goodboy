import { describe, expect, it } from 'vitest';
import type { TimelineRunEntry } from './buildTimelineGroups';
import { runStepProgress } from './runStepProgress';

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
