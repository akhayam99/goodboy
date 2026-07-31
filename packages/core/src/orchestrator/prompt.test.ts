import { describe, expect, it } from 'vitest';
import { buildOrchestratorUserPrompt } from './prompt';
import type { OrchestratorInput } from './types';

const input = (overrides: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  goal: 'Ship the change',
  processText: 'Inspect, implement, test.',
  completedSteps: [],
  openQuestionCount: 0,
  providerId: 'anthropic',
  modelMenu: [],
  roleDefaults: [],
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
});
