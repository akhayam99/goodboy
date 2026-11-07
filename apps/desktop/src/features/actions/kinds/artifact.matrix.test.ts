// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { NOT_REVISING } from '../../plans/planRevising';
import { resolveActions } from '../resolveActions';
import { ARTIFACT_KIND, type ArtifactFacts } from './artifact';
import {
  plan,
  report,
  wireframe,
  planFacts,
  reportFacts,
  DELETE,
  FOR_GOOD,
  ARTIFACT_STATES,
} from '../../../__tests__/helpers/artifactMenuStates';

describe('artifact verbs by kind and state', () => {
  it.each(ARTIFACT_STATES)('$name', ({ facts, expected }) => {
    expect(matrixOf({ definitions: ARTIFACT_KIND.actions, facts })).toEqual(expected);
  });

  it.each(ARTIFACT_STATES)('$name: one primary at most', ({ facts }) => {
    const primaries = resolveActions({ definitions: ARTIFACT_KIND.actions, facts }).filter(
      (action) => action.slot === 'primary',
    );
    expect(primaries.length).toBeLessThanOrEqual(1);
  });

  it('offers Delete on every stored artifact that is not deleted, and never on a generation', () => {
    const offered = ARTIFACT_STATES.filter(({ facts }) =>
      matrixOf({ definitions: ARTIFACT_KIND.actions, facts }).includes(DELETE),
    ).map(({ name }) => name);
    expect(offered).toEqual([
      'plan ready to run',
      'plan running',
      'plan that ran',
      'plan replaced by a newer one',
      'report',
      'report replaced',
      'wireframe',
    ]);
  });

  it('offers Delete permanently only on a deleted artifact', () => {
    const offered = ARTIFACT_STATES.filter(({ facts }) =>
      matrixOf({ definitions: ARTIFACT_KIND.actions, facts }).includes(FOR_GOOD),
    ).map(({ name }) => name);
    expect(offered).toEqual(['plan deleted', 'report deleted', 'wireframe deleted']);
  });

  it('runs Delete at once with an Undo and asks before deleting for good', () => {
    const live = resolveActions({
      definitions: ARTIFACT_KIND.actions,
      facts: reportFacts({ status: 'active' }),
    }).find((action) => action.id === 'artifact.delete');
    expect([live?.isUndoable, live?.confirm]).toEqual([true, null]);
    const gone = resolveActions({
      definitions: ARTIFACT_KIND.actions,
      facts: reportFacts({ status: 'discarded' }),
    }).find((action) => action.id === 'artifact.deletePermanently');
    expect(gone?.confirm?.role).toBe('danger');
  });

  it('blocks Run plan with a reason while the planner revises the plan, and only then', () => {
    const runPlanOf = (planRevising: ArtifactFacts['planRevising']) =>
      resolveActions({
        definitions: ARTIFACT_KIND.actions,
        facts: { ...planFacts({ status: 'active' }), planRevising },
      }).find((action) => action.id === 'artifact.runPlan');
    expect(runPlanOf({ kind: 'revising', nextRevision: 2 })?.blockedReason).toBe(
      'The planner is revising this plan',
    );
    expect(runPlanOf(NOT_REVISING)?.blockedReason).toBeNull();
  });

  it('says deleting for good also loses the run history', () => {
    const ran = resolveActions({
      definitions: ARTIFACT_KIND.actions,
      facts: planFacts({ status: 'discarded', consumptionCount: 2 }),
    }).find((action) => action.id === 'artifact.deletePermanently');
    expect(ran?.confirm?.description).toContain('Run by Implementer 3 +1 more');
  });
});
