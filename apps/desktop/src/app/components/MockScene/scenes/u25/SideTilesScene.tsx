import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { seedSideSignals } from './seedSideSignals';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const SideTilesScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedFrame({ context: 'board' });
    seedSideSignals({ isBusy: true });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="board" isRailCollapsed={false} hasPane />;
};
