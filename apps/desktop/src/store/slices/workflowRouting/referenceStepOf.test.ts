// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type SessionId,
  type Step,
  type StepId,
  type WorkflowId,
  type WorkflowRoutingDecision,
} from '@goodboy/types';
import { referenceStepOf } from './referenceStepOf';

const STEP: Step = {
  id: brandId<StepId>({ value: 'step-review' }),
  workflowId: brandId<WorkflowId>({ value: 'workflow-ledger-core' }),
  ordinal: 0,
  name: 'Review',
  role: 'reviewer',
  promptPrefix: 'Review the retry change in payments-api.',
};

const DECISION: WorkflowRoutingDecision = {
  version: 1,
  proposal: null,
  selected: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
  source: 'kind_default',
  reason: 'Codex: most room left',
  adjustment: 'none',
  executed: null,
};

const AGENT: Agent = {
  id: brandId<AgentId>({ value: 'agent-review' }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  stepId: STEP.id,
  ordinal: 0,
  name: 'Review',
  status: 'pending',
  routingDecision: DECISION,
};

describe('referenceStepOf', () => {
  it('reads the pick the agent was started on, so the composer does not call it changed', () => {
    expect(referenceStepOf({ step: STEP, agent: AGENT })?.routingDecision).toEqual(DECISION);
  });

  it('keeps a decision the step itself carries', () => {
    const stepDecision = { ...DECISION, reason: 'Claude: first in your order' };
    expect(
      referenceStepOf({ step: { ...STEP, routingDecision: stepDecision }, agent: AGENT })
        ?.routingDecision,
    ).toEqual(stepDecision);
  });

  it('leaves an agent with no step alone', () => {
    expect(referenceStepOf({ step: null, agent: AGENT })).toBeNull();
  });
});
