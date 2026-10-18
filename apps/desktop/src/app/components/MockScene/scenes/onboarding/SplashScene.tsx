import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BootCover } from '../../../BootSplash/BootCover';
import { BootStage } from '../../../BootSplash/BootStage';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const SplashScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return (
    <BootCover className="relative h-screen">
      <BootStage phase="loading-workspaces" />
    </BootCover>
  );
};
