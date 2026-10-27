import type { WizardMode, WizardStepId } from './wizardSteps';

export type WizardCta = {
  readonly primary: string | null;
  readonly skip: string | null;
  readonly reason: string | null;
};

const RETRY_LABEL = 'Retry';

const AGENT_GATE_REASON = 'Get one agent ready to continue.';

type Params = {
  readonly step: WizardStepId;
  readonly mode: WizardMode;
  readonly readyCount: number;
  readonly isIssuePick: boolean;
  readonly hasFailed: boolean;
};

const cta = ({ primary, skip = null, reason = null }: Partial<WizardCta>): WizardCta => ({
  primary: primary ?? null,
  skip,
  reason,
});

export const wizardCta = ({
  step,
  mode,
  readyCount,
  isIssuePick,
  hasFailed,
}: Params): WizardCta => {
  switch (step) {
    case 'welcome':
      return cta({ primary: 'Get started' });
    case 'agents':
      if (hasFailed) {
        return cta({ primary: RETRY_LABEL });
      }
      return cta({
        primary: 'Continue',
        reason: readyCount === 0 ? AGENT_GATE_REASON : null,
      });
    case 'workspace':
      return cta({});
    case 'tools':
      return cta({ primary: mode === 'single' ? 'Done' : 'Continue' });
    case 'first-session':
      return cta({ primary: isIssuePick ? 'Draft the brief' : 'Start', skip: 'Skip' });
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
