import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PhaseDefinition, PhaseRun, PhaseTemplate } from '@kay-am/types';
import { nextPhase, isPhaseSequenceComplete } from '../sequencer';
import { PhaseContextPropagator } from '../propagator';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;

const PLANNER: PhaseDefinition = {
  id: 'p-planner' as PhaseDefinition['id'],
  templateId: 'tpl-1' as PhaseDefinition['templateId'],
  ordinal: 1,
  name: 'planner',
  promptPrefix: 'plan the work',
};
const CODER: PhaseDefinition = {
  id: 'p-coder' as PhaseDefinition['id'],
  templateId: 'tpl-1' as PhaseDefinition['templateId'],
  ordinal: 2,
  name: 'coder',
  promptPrefix: 'implement plan',
};
const REVIEWER: PhaseDefinition = {
  id: 'p-reviewer' as PhaseDefinition['id'],
  templateId: 'tpl-1' as PhaseDefinition['templateId'],
  ordinal: 3,
  name: 'reviewer',
  promptPrefix: 'review code',
};

const TEMPLATE: PhaseTemplate = {
  id: 'tpl-1' as PhaseTemplate['id'],
  workspaceId: 'w1' as PhaseTemplate['workspaceId'],
  name: 'planner→coder→reviewer',
  description: 'three-phase pipeline',
  definitions: [PLANNER, CODER, REVIEWER],
  createdAt: AT,
  updatedAt: AT,
};

function completedRun(def: PhaseDefinition, summary: string): PhaseRun {
  return {
    id: `run-${def.id}` as PhaseRun['id'],
    sessionId: 's1' as PhaseRun['sessionId'],
    phaseDefinitionId: def.id,
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
    const propagator = new PhaseContextPropagator({ summarizer });

    const runs: PhaseRun[] = [];

    const first = nextPhase(TEMPLATE, runs);
    expect(first).toBe(PLANNER);
    expect(first?.ordinal).toBe(1);
    runs.push(completedRun(PLANNER, 'plan output v1'));

    const second = nextPhase(TEMPLATE, runs);
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

    const third = nextPhase(TEMPLATE, runs);
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

    expect(nextPhase(TEMPLATE, runs)).toBeNull();
    expect(isPhaseSequenceComplete(TEMPLATE, runs)).toBe(true);
  });
});
