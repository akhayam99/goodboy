import { useOnboardingWizard } from './useOnboardingWizard';
import { WizardFrame } from './WizardFrame';

type Props = {
  readonly isMainWindow?: boolean;
};

export const OnboardingWizard = ({ isMainWindow = true }: Props) => {
  const { isOpen, close, ...state } = useOnboardingWizard({ isMainWindow });
  if (!isOpen) {
    return null;
  }
  return <WizardFrame key={`${state.mode}:${state.start ?? ''}`} {...state} onClose={close} />;
};
