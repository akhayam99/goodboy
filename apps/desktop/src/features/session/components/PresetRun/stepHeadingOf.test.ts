import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STEP_BUILD,
  STEP_PLAN,
  agentFixture,
  workflowFixture,
} from '../../../../__tests__/helpers/actionFixtures';
import { stepHeadingOf } from './stepHeadingOf';

const workflow = workflowFixture();

describe('stepHeadingOf', () => {
  it('says the step and its role once when the agent keeps the step name', () => {
    const agent = agentFixture({ name: 'Build', stepId: STEP_BUILD });

    expect(stepHeadingOf({ agent, stepAgent: agent, workflow, role: 'Implementer' })).toBe(
      'Step 2 · Implementer',
    );
  });

  it('keeps a name the owner chose', () => {
    const agent = agentFixture({ name: 'Payments cutover', stepId: STEP_BUILD });

    expect(stepHeadingOf({ agent, stepAgent: agent, workflow, role: 'Implementer' })).toBe(
      'Step 2 · Implementer · Payments cutover',
    );
  });

  it('leaves no trailing dot for a blank name', () => {
    const agent = agentFixture({ name: '  ', stepId: STEP_PLAN });

    expect(stepHeadingOf({ agent, stepAgent: agent, workflow, role: 'Planner' })).toBe(
      'Step 1 · Planner',
    );
  });

  it('names a helper under its step', () => {
    const stepAgent = agentFixture({ name: 'Build', stepId: STEP_BUILD });
    const agent = agentFixture({
      id: brandId<AgentId>({ value: 'agent-helper' }),
      name: 'Build',
      parentAgentId: stepAgent.id,
    });

    expect(stepHeadingOf({ agent, stepAgent, workflow, role: 'Helper' })).toBe(
      'Step 2 · Helper · Build',
    );
  });
});
