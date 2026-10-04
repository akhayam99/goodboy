// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { orchestratorProcessText, standingGuidanceSection } from './standingGuidance';

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
