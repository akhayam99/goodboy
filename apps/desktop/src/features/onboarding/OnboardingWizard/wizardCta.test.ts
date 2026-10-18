// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AGENT_GATE_REASON, wizardCta } from './wizardCta';
import type { WizardStepId } from './wizardSteps';

type Params = Partial<Parameters<typeof wizardCta>[0]> & {
  readonly step: WizardStepId;
};

const ctaOf = ({ step, ...rest }: Params) =>
  wizardCta({ step, mode: 'full', readyCount: 1, isIssuePick: false, hasFailed: false, ...rest });

describe('wizardCta', () => {
  it('pins one label per step, and Skip on First session only', () => {
    expect(ctaOf({ step: 'welcome' })).toEqual({
      primary: 'Get started',
      skip: null,
      reason: null,
    });
    expect(ctaOf({ step: 'agents' })).toEqual({ primary: 'Continue', skip: null, reason: null });
    expect(ctaOf({ step: 'workspace' })).toEqual({ primary: null, skip: null, reason: null });
    expect(ctaOf({ step: 'tools' })).toEqual({ primary: 'Continue', skip: null, reason: null });
    expect(ctaOf({ step: 'first-session' })).toEqual({
      primary: 'Start',
      skip: 'Skip',
      reason: null,
    });
  });

  it('says why Continue is off with no ready agent', () => {
    expect(ctaOf({ step: 'agents', readyCount: 0 }).reason).toBe(AGENT_GATE_REASON);
  });

  it('relabels the primary Retry after a failure', () => {
    expect(ctaOf({ step: 'agents', hasFailed: true }).primary).toBe('Retry');
    expect(ctaOf({ step: 'first-session', hasFailed: true }).primary).toBe('Retry');
  });

  it('drafts a brief when an issue is picked, and closes a single step with Done', () => {
    expect(ctaOf({ step: 'first-session', isIssuePick: true }).primary).toBe('Draft the brief');
    expect(ctaOf({ step: 'tools', mode: 'single' }).primary).toBe('Done');
  });

  it('never offers a skip word on Tools: Continue with nothing connected is the skip', () => {
    expect(ctaOf({ step: 'tools', readyCount: 0 }).skip).toBeNull();
  });
});
