// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildOrchestratorUserPrompt } from '@goodboy/core';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import {
  orchestratorProcessText,
  runGuidanceSection,
  standingGuidanceSection,
} from './standingGuidance';

const GUIDANCE = '- Open the PR as a draft.';
const rules = { ...DEFAULT_WORKFLOW_RULES, standingGuidance: GUIDANCE };

describe('orchestratorProcessText', () => {
  it('sends the standing guidance of the run to the orchestrator once', () => {
    expect(orchestratorProcessText({ processText: undefined, run: { rulesSnapshot: rules } })).toBe(
      GUIDANCE,
    );
    expect(orchestratorProcessText({ processText: GUIDANCE, run: { rulesSnapshot: rules } })).toBe(
      GUIDANCE,
    );
    expect(
      orchestratorProcessText({ processText: 'Stop at the PR.', run: { rulesSnapshot: rules } }),
    ).toBe(`Stop at the PR.\n\n${GUIDANCE}`);
  });

  it('keeps the process of today for a run without a copy of the rules', () => {
    expect(orchestratorProcessText({ processText: 'Stop at the PR.', run: {} })).toBe(
      'Stop at the PR.',
    );
  });
});

describe('standingGuidanceSection', () => {
  it('goes to the orchestrator, never to the agents, of an orchestrated run', () => {
    expect(
      standingGuidanceSection({
        run: { executionMode: 'dynamic', rulesSnapshot: rules },
        role: 'implementer',
      }),
    ).toBe('');
    expect(
      standingGuidanceSection({
        run: { executionMode: 'static', rulesSnapshot: rules },
        role: 'implementer',
      }),
    ).toBe(`**Guidance**\n${GUIDANCE}`);
  });
});

describe('runGuidanceSection', () => {
  it('is the Guidance heading and the trimmed text', () => {
    expect(runGuidanceSection({ text: '  Keep the diff small.\n' })).toBe(
      '**Guidance**\nKeep the diff small.',
    );
  });

  it('is empty when the run has no guidance', () => {
    expect(runGuidanceSection({ text: '' })).toBe('');
    expect(runGuidanceSection({ text: ' \n ' })).toBe('');
  });
});

describe('the guidance a run is started with', () => {
  const START_RULES = { ...DEFAULT_WORKFLOW_RULES, standingGuidance: 'Only touch payments-api.' };

  it('reaches the Operator process of the orchestrator of a run started with it', () => {
    const processText = orchestratorProcessText({
      processText: 'Inspect, implement, test.',
      run: { rulesSnapshot: START_RULES },
    });

    const prompt = buildOrchestratorUserPrompt({
      goal: 'Ship the change',
      processText,
      completedSteps: [],
      openQuestionCount: 0,
      providerId: 'anthropic',
      modelMenu: [],
      roleDefaults: [],
      stepsUsed: 0,
      isModelPickEnabled: true,
    });

    expect(prompt).toContain(
      'Operator process:\nInspect, implement, test.\n\nOnly touch payments-api.',
    );
  });

  it('still keeps the guidance away from the agents of that run', () => {
    expect(
      standingGuidanceSection({
        run: { executionMode: 'dynamic', rulesSnapshot: START_RULES },
        role: 'implementer',
      }),
    ).toBe('');
  });
});
