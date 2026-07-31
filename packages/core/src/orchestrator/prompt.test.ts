import { describe, expect, it } from 'vitest';
import { buildOrchestratorUserPrompt, ORCHESTRATOR_SYSTEM_PROMPT } from './prompt';
import type { OrchestratorInput } from './types';

const input = (overrides: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  goal: 'Ship the change',
  processText: 'Inspect, implement, test.',
  completedSteps: [],
  openQuestionCount: 0,
  providerId: 'anthropic',
  modelMenu: [],
  roleDefaults: [],
  stepsUsed: 0,
  stepBudget: 8,
  ...overrides,
});

describe('buildOrchestratorUserPrompt', () => {
  it('passes the operator hints through and tells the orchestrator they win', () => {
    const prompt = buildOrchestratorUserPrompt(
      input({ operatorHints: 'ignore the website, start from the migrations' }),
    );
    expect(prompt).toContain('Operator hints');
    expect(prompt).toContain('ignore the website, start from the migrations');
  });

  it('leaves the hints section out when there are none', () => {
    expect(buildOrchestratorUserPrompt(input())).not.toContain('Operator hints');
    expect(buildOrchestratorUserPrompt(input({ operatorHints: '   ' }))).not.toContain(
      'Operator hints',
    );
  });

  it('states how much of the step budget is already spent', () => {
    const prompt = buildOrchestratorUserPrompt(input({ stepsUsed: 5, stepBudget: 8 }));

    expect(prompt).toContain('Step budget: 5 used of 8');
  });

  it('presents the role defaults as the operator configuration', () => {
    const prompt = buildOrchestratorUserPrompt(
      input({ roleDefaults: [{ role: 'implementer', model: 'sonnet-5', effort: 'medium' }] }),
    );

    expect(prompt).toContain('Role defaults (operator configured');
    expect(prompt).toContain('implementer=sonnet-5/medium');
  });
});

describe('ORCHESTRATOR_SYSTEM_PROMPT', () => {
  it('dictates the flow rules that keep a run from running forever', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('Stay inside the step budget');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain(
      'Never reopen work a completed step already covers',
    );
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('planner step');
  });

  it('makes the operator role defaults the routing baseline', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("the operator's own configuration");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('When you deviate you must say so in reason');
  });

  it('gives reason an operator facing contract', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('reason is written for the operator');
  });
});
