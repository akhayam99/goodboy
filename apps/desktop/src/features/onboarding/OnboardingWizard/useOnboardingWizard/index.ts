import { useEffect, useState } from 'react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { isWizardDone, OPEN_WIZARD_EVENT } from '../../onboarding-store';

export interface OnboardingWizardState {
  readonly open: boolean;
  readonly providersConnected: number;
  readonly hasWorkspace: boolean;
}

export function useOnboardingWizard(): OnboardingWizardState {
  const providersConnected = useAppStore(
    (s) => s.providers.filter((p) => p.connection === 'connected').length,
  );
  const hasWorkspace = useWorkspaces().length > 0;

  const [open, setOpen] = useState(() => !isWizardDone() && !hasWorkspace);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onProgress = () => {
      if (isWizardDone()) setOpen(false);
    };
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen);
    window.addEventListener('goodboy:onboarding-progress', onProgress);
    return () => {
      window.removeEventListener(OPEN_WIZARD_EVENT, onOpen);
      window.removeEventListener('goodboy:onboarding-progress', onProgress);
    };
  }, []);

  return { open, providersConnected, hasWorkspace };
}
