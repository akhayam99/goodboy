import { OnboardingWizard } from '../../../../../features/onboarding/OnboardingWizard';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import { AppFrame } from '../audit/AppFrame';
import { useStoryBring } from './useStoryBring';

const WIZARD_MOTION =
  '*:not([aria-label="Goodboy setup"]), *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }';

export const StoryBringScene = () => {
  const { isReady, isLanded } = useStoryBring();
  if (!isReady) {
    return null;
  }
  return (
    <>
      <style>{WIZARD_MOTION}</style>
      {isLanded ? (
        <>
          <NewSessionBridge />
          <AppFrame view="inbox" hasPane hasDraft />
        </>
      ) : null}
      <OnboardingWizard />
    </>
  );
};
