import { describe, expect, it } from 'vitest';
import {
  formatWorkflowModelMenu,
  UNASSESSED_PROFILE_LABEL,
  WORKFLOW_MODEL_MENU_BUDGET,
} from './formatWorkflowModelMenu';
import { orchestratorModelPool } from './orchestratorModelPool';
import type { OrchestratorModelOption } from './types';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

const everythingConnected: WorkflowRoutingAvailabilitySnapshot = {
  connectedProviders: [
    'anthropic',
    'codex',
    'cursor',
    'gemini',
    'opencode',
    'openrouter',
    'moonshot',
  ],
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
};

const option = (overrides: Partial<OrchestratorModelOption> = {}): OrchestratorModelOption => ({
  provider: 'anthropic',
  model: 'test-model',
  label: 'Test Model',
  efforts: ['low', 'high'],
  taskTypes: [],
  preferredDifficulty: [],
  contextWindow: 200000,
  price: null,
  ...overrides,
});

describe('formatWorkflowModelMenu', () => {
  it('all available identities survive the size budget', () => {
    const options = orchestratorModelPool({ availability: everythingConnected });
    const menu = formatWorkflowModelMenu({ options });

    expect(options.length).toBeGreaterThan(0);
    expect(menu.length).toBeLessThanOrEqual(WORKFLOW_MODEL_MENU_BUDGET);
    options.forEach((entry) => {
      expect(menu).toContain(`${entry.provider}/${entry.model}`);
      const efforts = entry.efforts.length === 0 ? 'no effort control' : entry.efforts.join(',');
      expect(menu).toContain(`${entry.provider}/${entry.model} efforts ${efforts}`);
    });
  });

  it('keeps every identity and its efforts when the budget forces detail out', () => {
    const options = [
      option({
        provider: 'codex',
        model: 'alpha',
        efforts: ['low', 'high'],
        contextWindow: 400000,
      }),
      option({
        provider: 'anthropic',
        model: 'beta',
        efforts: [],
        price: { inputPerMtok: 3, outputPerMtok: 15 },
      }),
    ];
    const menu = formatWorkflowModelMenu({ options, budget: 80 });

    expect(menu).toBe('codex/alpha efforts low,high\nanthropic/beta efforts no effort control');
    expect(menu).not.toContain('ctx');
    expect(menu).not.toContain('$');
  });

  it('drops price before it drops the profile', () => {
    const options = [
      option({
        provider: 'codex',
        model: 'alpha',
        taskTypes: ['implementation'],
        preferredDifficulty: ['standard'],
        price: { inputPerMtok: 1.25, outputPerMtok: 10 },
      }),
    ];
    const full = formatWorkflowModelMenu({ options });
    const trimmed = formatWorkflowModelMenu({ options, budget: full.length - 1 });

    expect(full).toContain('$1.25/$10');
    expect(trimmed).toContain('imp|st');
    expect(trimmed).not.toContain('$1.25/$10');
  });

  it('renders a model nobody assessed as unassessed rather than inventing strengths', () => {
    const menu = formatWorkflowModelMenu({
      options: [option({ provider: 'moonshot', model: 'kimi', taskTypes: [] })],
    });

    expect(menu).toContain(`moonshot/kimi efforts low,high ${UNASSESSED_PROFILE_LABEL}`);
    expect(menu).toContain(
      `A model marked ${UNASSESSED_PROFILE_LABEL} has no reviewed routing profile`,
    );
  });

  it('says a price this build does not know is unknown rather than zero', () => {
    const menu = formatWorkflowModelMenu({ options: [option({ price: null })] });

    expect(menu).toContain('price unknown');
    expect(menu).not.toContain('$0');
  });

  it('fails loudly rather than fencing models off when identities alone exceed the budget', () => {
    const options = Array.from({ length: 40 }, (_entry, index) =>
      option({ model: `model-with-a-long-identity-${index}` }),
    );

    expect(() => formatWorkflowModelMenu({ options, budget: 200 })).toThrow(
      /over the 200 character budget/,
    );
  });
});
