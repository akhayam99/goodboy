// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { RunPlanResult } from '../../../store/slices/plans/types';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../test/planFixtures';
import type { ActionEnv } from '../types';
import { ARTIFACT_KIND } from './artifact';

const showToast = vi.fn();

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast,
  copyText: async () => undefined,
  origin: 'palette',
  anchorKey: null,
  viewing: null,
};

const runFromPalette = async (result: RunPlanResult) => {
  const runPlan = vi.fn(async () => result);
  const plan = aPlan();
  useAppStore.setState({
    runPlan,
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan({}, plan)] },
    agentTurnState: {},
  });
  const facts = ARTIFACT_KIND.facts({
    state: useAppStore.getState(),
    target: {
      kind: 'artifact',
      sessionId: PLAN_FIXTURE_SESSION,
      subject: { kind: 'stored', artifactId: PLAN_FIXTURE_ID, isPlanRunning: false },
    },
  });
  const definition = ARTIFACT_KIND.actions.find((action) => action.id === 'artifact.runPlan');
  if (facts === null || definition === undefined) {
    throw new Error('the plan facts or the Run plan action are missing');
  }
  await definition.run({ facts, env, choice: null });
  return runPlan;
};

beforeEach(() => {
  showToast.mockClear();
});

describe('Run plan from the palette and the menu', () => {
  it('announces the implementer only when one started', async () => {
    const runPlan = await runFromPalette({
      kind: 'started',
      agentId: 'agent-impl' as AgentId,
      scope: 'workflow',
    });

    expect(runPlan).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_FIXTURE_ID);
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({ title: 'Implementer started' });
  });

  it('says why nothing started and offers the run, never "Implementer started"', async () => {
    await runFromPalette({
      kind: 'refused',
      reason: 'The workflow has no step left for this plan',
      workflowRunId: 'run-settlement' as WorkflowRunId,
    });

    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      title: 'Plan not started',
      message: 'The workflow has no step left for this plan',
      action: { label: 'Open the run' },
    });
  });

  it('says a plan started outside its workflow when the run was discarded', async () => {
    await runFromPalette({
      kind: 'startedOutside',
      agentId: 'agent-impl' as AgentId,
      note: 'Started outside the workflow, its run was discarded',
    });

    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      title: 'Implementer started',
      message: 'Started outside the workflow, its run was discarded',
    });
  });

  it('stays quiet when a gate already notified the owner', async () => {
    await runFromPalette({ kind: 'refused', reason: null, workflowRunId: null });

    expect(showToast).not.toHaveBeenCalled();
  });
});
