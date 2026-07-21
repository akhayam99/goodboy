import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Step, Agent, Workflow } from '@goodboy/types';
import { buildStepPrompt, nextStep, isWorkflowComplete } from '../sequencer';
import { buildChainCarryForward } from '../propagator';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;

const PLANNER: Step = {
  id: 'p-planner' as Step['id'],
  workflowId: 'tpl-1' as Step['workflowId'],
  ordinal: 1,
  name: 'planner',
  promptPrefix: 'plan the work',
};
const CODER: Step = {
  id: 'p-coder' as Step['id'],
  workflowId: 'tpl-1' as Step['workflowId'],
  ordinal: 2,
  name: 'coder',
  promptPrefix: 'implement plan',
};
const REVIEWER: Step = {
  id: 'p-reviewer' as Step['id'],
  workflowId: 'tpl-1' as Step['workflowId'],
  ordinal: 3,
  name: 'reviewer',
  promptPrefix: 'review code',
};

const TEMPLATE: Workflow = {
  id: 'tpl-1' as Workflow['id'],
  workspaceId: 'w1' as Workflow['workspaceId'],
  name: 'planner→coder→reviewer',
  description: 'three-phase pipeline',
  steps: [PLANNER, CODER, REVIEWER],
  createdAt: AT,
  updatedAt: AT,
};

type Params = {
  readonly definition: Step;
  readonly summary: string;
};

const completedRun = ({ definition, summary }: Params): Agent => {
  return {
    id: `run-${definition.id}` as Agent['id'],
    sessionId: 's1' as Agent['sessionId'],
    stepId: definition.id,
    ordinal: definition.ordinal,
    name: definition.name,
    status: 'completed',
    outputSummary: summary,
  };
};

describe('phase orchestration end-to-end', () => {
  it('drives planner to coder to reviewer with carry-forward context', () => {
    const runs: Agent[] = [];

    const first = nextStep(TEMPLATE, runs);
    expect(first).toBe(PLANNER);
    expect(first?.ordinal).toBe(1);
    runs.push(completedRun({ definition: PLANNER, summary: 'plan output v1' }));

    const second = nextStep(TEMPLATE, runs);
    expect(second).toBe(CODER);
    expect(second?.ordinal).toBe(2);

    const carryForwardToCoder = buildChainCarryForward({
      steps: runs.map((run) => ({
        ordinal: run.ordinal,
        name: run.name,
        outputSummary: run.outputSummary,
      })),
    });
    expect(carryForwardToCoder).toBe(
      '## workflow handoff\n### step 1 output: planner\nplan output v1',
    );
    expect(
      buildStepPrompt({
        definition: CODER,
        carryForwardContext: carryForwardToCoder,
        userMessage: 'ship it',
      }),
    ).toBe(`implement plan\n\n${carryForwardToCoder}\n\nship it`);

    runs.push(completedRun({ definition: CODER, summary: 'code diff v1' }));

    const third = nextStep(TEMPLATE, runs);
    expect(third).toBe(REVIEWER);
    expect(third?.ordinal).toBe(3);

    const carryForwardToReviewer = buildChainCarryForward({
      steps: runs.map((run) => ({
        ordinal: run.ordinal,
        name: run.name,
        outputSummary: run.outputSummary,
      })),
    });
    expect(carryForwardToReviewer).toBe(
      '## workflow handoff\n### step 2 output: coder\ncode diff v1\n### earlier steps\n- step 1 planner: plan output v1',
    );

    runs.push(completedRun({ definition: REVIEWER, summary: 'review notes' }));

    expect(nextStep(TEMPLATE, runs)).toBeNull();
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(true);
  });
});
