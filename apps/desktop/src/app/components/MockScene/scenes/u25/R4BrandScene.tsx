import { useEffect } from 'react';
import { finish as finishOnboarding } from '../../../../../features/onboarding/onboardingSettings';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BoardShellScene } from '../BoardShellScene';

const CLICK_DELAY_MS = 250;

type Props = {
  readonly theme: 'dark' | 'light';
};

export const R4BrandScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
    finishOnboarding();
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLElement>('[data-testid="goodboy-chip"]');
      if (trigger === null) {
        return;
      }
      trigger.click();
      window.clearInterval(timer);
    }, CLICK_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [theme]);
  return <BoardShellScene />;
};
