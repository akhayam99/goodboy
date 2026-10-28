import { describe, expect, it } from 'vitest';
import type { RunStepState } from '../../timeline/runStepProgress';
import type { LiveRunStepModel } from './liveGroupsOf';
import { stepCountOf } from './stepCountOf';

type StepsParams = {
  readonly states: ReadonlyArray<RunStepState>;
};

const stepsOf = ({ states }: StepsParams): ReadonlyArray<LiveRunStepModel> =>
  states.map((state, index) => ({
    number: index + 1,
    title: `Step ${index + 1}`,
    kind: 'implementer',
    state,
  }));

describe('the step count of a short run', () => {
  it('counts the steps that started over the steps of the run', () => {
    expect(stepCountOf({ steps: stepsOf({ states: ['running', 'notStarted'] }) })).toBe('1/2');
  });

  it('counts a finished step as started', () => {
    expect(stepCountOf({ steps: stepsOf({ states: ['done', 'waiting'] }) })).toBe('2/2');
  });

  it('says 0 before the first step starts', () => {
    expect(stepCountOf({ steps: stepsOf({ states: ['notStarted', 'notStarted'] }) })).toBe('0/2');
  });
});
