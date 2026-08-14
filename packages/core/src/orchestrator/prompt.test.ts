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

  it('states the steps spent without any cap to close on', () => {
    const prompt = buildOrchestratorUserPrompt(input({ stepsUsed: 5 }));

    expect(prompt).toContain('Steps used: 5');
    expect(prompt).not.toContain('Hard cap');
  });

  it('states the spend against the limit the operator allowed', () => {
    const prompt = buildOrchestratorUserPrompt(input({ spendLimitUsd: 20, spentUsd: 8.4 }));

    expect(prompt).toContain('Spend: $8.40 of the $20.00 the operator allowed');
  });

  it('leaves the spend line out when the run is uncapped', () => {
    expect(buildOrchestratorUserPrompt(input({ spentUsd: 8.4 }))).not.toContain('Spend:');
  });

  it('presents the model menu as the routing pool rather than a catalog', () => {
    const prompt = buildOrchestratorUserPrompt(
      input({ modelMenu: [{ id: 'sonnet-5', label: 'Sonnet 5', note: 'balanced default' }] }),
    );

    expect(prompt).toContain('Routing pool, the only models you may pick');
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
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('treat that estimate as your own soft cap');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('never because a count was reached');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('unless the operator explicitly asks for more');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain(
      'Never reopen work a completed step already covers',
    );
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('planner step');
  });

  it('never gives the orchestrator a count to close on', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toContain('step budget');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toContain('reaches the budget');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toContain('hard cap');
  });

  it('makes the operator role defaults the routing baseline', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("the operator's own configuration");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('When you deviate you must say so in reason');
  });

  it('warns that a model outside the listed pool is rejected', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('The listed ids are the whole routing pool');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('falls back to the role default');
  });

  it('gives reason an operator facing contract', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('reason is written for the operator');
  });
  it('asks for a running recap alongside every decision', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('<<run-summary>>');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('<</run-summary>>');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('it replaces the previous one every time');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('including done and blocked');
  });
});
