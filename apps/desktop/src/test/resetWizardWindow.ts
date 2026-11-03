import { beforeEach } from 'vitest';
import { WIZARD_WINDOW_DECISION } from '../features/onboarding/OnboardingWizard/wizardWindowDecision';

beforeEach(() => {
  WIZARD_WINDOW_DECISION.hasDecided = false;
});
