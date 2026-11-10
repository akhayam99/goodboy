import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';
import { SideTilesScene } from './SideTilesScene';
import { seedSideSignals } from './seedSideSignals';

type Props = {
  readonly isBusy: boolean;
  readonly theme?: 'dark' | 'light';
};

const SideSignalsScene = ({ isBusy, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
    seedSideSignals({ isBusy });
    setIsReady(true);
  }, [isBusy, theme]);
  if (!isReady) {
    return null;
  }
  return <SidebarNavColumnScene config={{}} />;
};

export const U25_B_SIDE_SIGNALS_SCENES = {
  'side-signals-running': () => <SideSignalsScene isBusy />,
  'side-signals-idle': () => <SideSignalsScene isBusy={false} />,
  'side-tiles-dark': () => <SideTilesScene theme="dark" />,
  'side-tiles-light': () => <SideTilesScene theme="light" />,
};
