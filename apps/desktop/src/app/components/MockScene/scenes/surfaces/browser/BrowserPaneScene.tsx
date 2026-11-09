import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { AppFrame } from '../../audit/AppFrame';
import { useSceneRailFold } from '../../useSceneRailFold';
import { seedBrowserPane, type BrowserPaneSceneState } from './browserPaneSeed';
import { usePeekedLink } from './usePeekedLink';

type Props = {
  readonly state: BrowserPaneSceneState;
  readonly theme: 'light' | 'dark';
};

export const BrowserPaneScene = ({ state, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useSceneRailFold({ isFolded: false });
  usePeekedLink({ isOn: isReady && state === 'peek' });
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedBrowserPane({ state });
    setIsReady(true);
  }, [state, theme]);
  if (!isReady) {
    return null;
  }
  return (
    <AppFrame view={state === 'page' ? 'browser' : 'session'} isRailCollapsed={false} hasPane />
  );
};
