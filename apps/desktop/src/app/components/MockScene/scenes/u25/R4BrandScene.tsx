import { useEffect } from 'react';
import { finish as finishOnboarding } from '../../../../../features/onboarding/onboardingSettings';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BoardShellScene } from '../BoardShellScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const R4BrandScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
    finishOnboarding();
  }, [theme]);
  return <BoardShellScene />;
};
