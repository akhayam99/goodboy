import { useEffect, useRef, useState } from 'react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { isWizardDone, OPEN_WIZARD_EVENT } from '../../onboarding-store';

export type OnboardingWizardState = {
  readonly open: boolean;
  readonly providersConnected: number;
  readonly hasWorkspace: boolean;
};

export const useOnboardingWizard = (): OnboardingWizardState => {
  const providersConnected = useAppStore(
    (s) => s.providers.filter((p) => p.connection === 'connected').length,
  );
  const hasWorkspace = useWorkspaces().length > 0;
  const hydrated = useAppStore((s) => s.hydrated);

  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    const onOpen = () => {
      decided.current = true;
      setOpen(true);
    };
    const onProgress = () => {
      if (isWizardDone()) {
        decided.current = true;
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen);
    window.addEventListener('goodboy:onboarding-progress', onProgress);
    return () => {
      window.removeEventListener(OPEN_WIZARD_EVENT, onOpen);
      window.removeEventListener('goodboy:onboarding-progress', onProgress);
    };
  }, []);

  useEffect(() => {
    if (decided.current || !hydrated) {
      return;
    }
    if (!isWizardDone() && !hasWorkspace) {
      decided.current = true;
      setOpen(true);
    }
  }, [hydrated, hasWorkspace]);

  return { open, providersConnected, hasWorkspace };
};
