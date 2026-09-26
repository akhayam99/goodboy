import { useOnboardingWizard } from './useOnboardingWizard';
import { WizardFrame } from './WizardFrame';

export const OnboardingWizard = () => {
  const { open, ...state } = useOnboardingWizard();
  if (!open) {
    return null;
  }
  return <WizardFrame key={`${state.mode}:${state.start ?? ''}`} {...state} />;
};
