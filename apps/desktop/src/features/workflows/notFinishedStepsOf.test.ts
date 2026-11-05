// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { finishedWithGapsPhrase } from './finishedWithGapsPhrase';
import { notFinishedStepsOf } from './notFinishedStepsOf';

const PLAN: AgentId = JSON.parse('"agent-plan"');
const BUILD: AgentId = JSON.parse('"agent-build"');
const PART: AgentId = JSON.parse('"agent-part"');

describe('notFinishedStepsOf', () => {
  it('numbers a not finished step by its place among the steps', () => {
    const agents = [
      anAgent({ id: PLAN, ordinal: 0, status: 'completed' }),
      anAgent({ id: BUILD, ordinal: 1, status: 'skipped', outputSummary: 'no repo' }),
    ];

    expect(notFinishedStepsOf({ agents }).map((step) => step.number)).toEqual([2]);
  });

  it('leaves out a step the user skipped and a part that did not start', () => {
    const agents = [
      anAgent({ id: PLAN, ordinal: 0, status: 'skipped' }),
      anAgent({ id: BUILD, ordinal: 1, status: 'running' }),
      anAgent({
        id: PART,
        ordinal: 2,
        parentAgentId: BUILD,
        status: 'skipped',
        outputSummary: 'Did not start: it depends on part 1, which did not finish.',
      }),
    ];

    expect(notFinishedStepsOf({ agents })).toEqual([]);
  });

  it('points a not finished part at the step that owns it', () => {
    const agents = [
      anAgent({ id: PLAN, ordinal: 0, status: 'completed' }),
      anAgent({ id: BUILD, ordinal: 1, status: 'completed' }),
      anAgent({
        id: PART,
        ordinal: 2,
        parentAgentId: BUILD,
        status: 'skipped',
        outputSummary: 'the build is red',
      }),
    ];

    expect(notFinishedStepsOf({ agents }).map((step) => step.number)).toEqual([2]);
  });
});

describe('finishedWithGapsPhrase', () => {
  it('counts steps without ever saying plain done', () => {
    expect(finishedWithGapsPhrase({ count: 1 })).toBe('Finished, 1 step not finished');
    expect(finishedWithGapsPhrase({ count: 2 })).toBe('Finished, 2 steps not finished');
  });
});
