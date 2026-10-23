import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import type { DemoHint, HintCheck } from './demoHintTypes';

type RootParams = {
  readonly root: Document;
};

const stepIndexOf = ({ root }: RootParams): number => {
  const step = root.querySelector('[aria-label="Goodboy setup"]')?.getAttribute('data-step');
  return WIZARD_STEPS.findIndex((entry) => entry === step);
};

type StepParams = {
  readonly step: WizardStepId;
};

const isOnStep =
  ({ step }: StepParams): HintCheck =>
  ({ root }) =>
    stepIndexOf({ root }) === WIZARD_STEPS.indexOf(step);

const isPastStep =
  ({ step }: StepParams): HintCheck =>
  ({ root }) =>
    stepIndexOf({ root }) > WIZARD_STEPS.indexOf(step);

export const ONBOARDING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'setup-start',
    copy: 'See the agents ready to use',
    outcome: 'setup-opened',
    anchor: '[data-step="welcome"] [data-demo-anchor="setup-start"]',
    revealWhen: isOnStep({ step: 'welcome' }),
    doneWhen: isPastStep({ step: 'welcome' }),
  },
  {
    id: 'setup-agents',
    copy: 'Continue with your ready agents',
    outcome: 'agents-ready',
    anchor: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    revealWhen: isOnStep({ step: 'agents' }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-workspace',
    copy: 'Choose the sample Harborline folder',
    outcome: 'workspace-created',
    anchor: '[data-step="workspace"] [data-demo-anchor="setup-choose-folder"]',
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-tools',
    copy: 'Continue, sample tools are ready',
    outcome: 'tools-tried',
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
  {
    id: 'setup-first-task',
    copy: 'Pick a starter task',
    outcome: 'first-task',
    anchor: '[data-step="first-session"] [role="group"][aria-label="Starters"]',
    revealWhen: isOnStep({ step: 'first-session' }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];
