import { describe, expect, it } from 'vitest';
import { buildOrchestratorUserPrompt } from './prompt';
import type { OrchestratorInput } from './types';

const input = (overrides: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  goal: 'Center the Harborline member pages',
  processText: '',
  completedSteps: [],
  openQuestionCount: 0,
  providerId: 'anthropic',
  modelMenu: [],
  roleDefaults: [],
  stepsUsed: 0,
  ...overrides,
});

const PRESET: NonNullable<OrchestratorInput['preset']> = {
  name: 'Fix a layout',
  closeness: 'follow',
  steps: [
    { name: 'Find the broken widths', role: 'scout', instructions: '', isPinned: false },
    {
      name: 'Center the pages',
      role: 'implementer',
      instructions: 'Center every member page.\n\n  Keep the Harborline header fixed.',
      isPinned: true,
    },
  ],
  changes: [],
};

describe('buildOrchestratorUserPrompt with a preset', () => {
  it('lists the preset steps in order and marks a pinned one', () => {
    const prompt = buildOrchestratorUserPrompt(input({ preset: PRESET }));

    expect(prompt).toContain('Preset: Fix a layout, Follow the preset.');
    expect(prompt).toContain('1. scout: Find the broken widths');
    expect(prompt).toContain(
      '2. implementer: Center the pages (pinned: run it as written, never skip or move it)',
    );
    expect(prompt).toContain('"presetStep"');
  });

  it('gives each step its saved instructions on one line, and none for an empty one', () => {
    const prompt = buildOrchestratorUserPrompt(input({ preset: PRESET }));

    expect(prompt).toContain(
      '   Instructions: Center every member page. Keep the Harborline header fixed.',
    );
    expect(prompt.match(/Instructions:/g)).toHaveLength(1);
    expect(prompt).toContain('writing each brief from the step, its instructions and the goal');
  });

  it('under Follow forbids adding or skipping on its own and asks for the change field', () => {
    const prompt = buildOrchestratorUserPrompt(input({ preset: PRESET }));

    expect(prompt).toContain('Do not add, skip or move a step on your own.');
    expect(prompt).toContain('"change":{"kind":"added|skipped|reordered"');
    expect(prompt).not.toContain('Add a step when a finding asks for it');
  });

  it('under Adapt allows adding, skipping and moving with a reason', () => {
    const prompt = buildOrchestratorUserPrompt(
      input({ preset: { ...PRESET, closeness: 'adapt' } }),
    );

    expect(prompt).toContain('Preset: Fix a layout, Adapt as it goes.');
    expect(prompt).toContain('Add a step when a finding asks for it');
    expect(prompt).not.toContain('Do not add, skip or move a step on your own.');
  });

  it('ranks the goal, the process and the hints above the preset', () => {
    const prompt = buildOrchestratorUserPrompt(input({ preset: PRESET }));

    expect(prompt).toContain(
      'The goal, the operator process and the hints rank above the preset. Never change a pinned step.',
    );
  });

  it('repeats the changes already made', () => {
    const prompt = buildOrchestratorUserPrompt(
      input({
        preset: {
          ...PRESET,
          closeness: 'adapt',
          changes: [
            { kind: 'added', step: 'Fix the billing table', reason: 'It scrolls at 390px' },
          ],
        },
      }),
    );

    expect(prompt).toContain('- added: Fix the billing table (It scrolls at 390px)');
  });

  it('leaves the preset section out of a run without a preset', () => {
    expect(buildOrchestratorUserPrompt(input())).not.toContain('Preset:');
  });
});
