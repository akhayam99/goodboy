import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Step, Agent, Workflow } from '@goodboy/types';
import { nextStep, isWorkflowComplete } from '../sequencer';
import { WorkflowPropagator } from '../propagator';

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

function completedRun(def: Step, summary: string): Agent {
  return {
    id: `run-${def.id}` as Agent['id'],
    sessionId: 's1' as Agent['sessionId'],
    stepId: def.id,
    ordinal: def.ordinal,
    name: def.name,
    status: 'completed',
    outputSummary: summary,
  };
}

describe('phase orchestration end-to-end', () => {
  it('drives planner → coder → reviewer with carry-forward context', async () => {
    const summarizer = {
      async summarizePhaseOutput(text: string): Promise<string> {
        return `summary(${text})`;
      },
    };
    const propagator = new WorkflowPropagator({ summarizer });

    const runs: Agent[] = [];

    const first = nextStep(TEMPLATE, runs);
    expect(first).toBe(PLANNER);
    expect(first?.ordinal).toBe(1);
    runs.push(completedRun(PLANNER, 'plan output v1'));

    const second = nextStep(TEMPLATE, runs);
    expect(second).toBe(CODER);
    expect(second?.ordinal).toBe(2);

    const transitionToCoder = await propagator.buildTransition({
      fromOrdinal: PLANNER.ordinal,
      toOrdinal: CODER.ordinal,
      completedPhaseOutput: 'plan output v1',
      existingSlots: [],
      at: AT,
    });
    expect(transitionToCoder.fromOrdinal).toBe(1);
    expect(transitionToCoder.toOrdinal).toBe(2);
    expect(transitionToCoder.carryForwardContext).toContain('plan output v1');

    runs.push(completedRun(CODER, 'code diff v1'));

    const third = nextStep(TEMPLATE, runs);
    expect(third).toBe(REVIEWER);
    expect(third?.ordinal).toBe(3);

    const transitionToReviewer = await propagator.buildTransition({
      fromOrdinal: CODER.ordinal,
      toOrdinal: REVIEWER.ordinal,
      completedPhaseOutput: 'code diff v1',
      existingSlots: [],
      at: AT,
    });
    expect(transitionToReviewer.carryForwardContext).toContain('code diff v1');

    runs.push(completedRun(REVIEWER, 'review notes'));

    expect(nextStep(TEMPLATE, runs)).toBeNull();
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(true);
  });
});
