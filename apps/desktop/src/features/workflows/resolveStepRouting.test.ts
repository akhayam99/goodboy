import { describe, expect, it } from 'vitest';
import type { Step, StepId, WorkflowId } from '@goodboy/types';
import { resolveStepRouting } from './resolveStepRouting';

const WF_ID = 'wf-1' as WorkflowId;

const step = (patch: Partial<Step>): Step =>
  ({
    id: 's-1' as StepId,
    workflowId: WF_ID,
    ordinal: 0,
    name: 'Do the thing',
    promptPrefix: '',
    ...patch,
  }) as Step;

describe('resolveStepRouting', () => {
  it('lets an explicit step model win over the agent pin', () => {
    const routing = resolveStepRouting({
      step: step({ modelOverride: 'opus-5' }),
      kind: 'generic',
      roleModels: null,
      agentModel: 'haiku-4.5',
    });

    expect(routing.model).toBe('opus-5');
  });

  it('prefers the role recommendation over the name-inferred kind default', () => {
    const byRole = resolveStepRouting({
      step: step({ role: 'planner' }),
      kind: 'generic',
      roleModels: null,
    });
    const byKind = resolveStepRouting({ step: null, kind: 'generic', roleModels: null });

    expect(byRole.model).not.toBe(byKind.model);
    expect(byRole.effort).toBe('high');
  });

  it('falls back to the agent pin when the step carries no routing', () => {
    const routing = resolveStepRouting({
      step: step({}),
      kind: 'generic',
      roleModels: null,
      agentModel: 'sonnet-5',
    });

    expect(routing.model).toBe('sonnet-5');
  });

  it('takes the effort from the step when the orchestrator set one', () => {
    const routing = resolveStepRouting({
      step: step({ role: 'implementer', effort: 'xhigh' }),
      kind: 'generic',
      roleModels: null,
    });

    expect(routing.effort).toBe('xhigh');
  });
});
