import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { PaletteOverlay } from '../../../../../../features/palette/components/PaletteOverlay';
import { AppFrame } from '../../audit/AppFrame';
import { useSceneRailFold } from '../../useSceneRailFold';
import { BrowserCoverMenu } from './BrowserCoverMenu';
import { seedBrowserPane, type BrowserPaneSceneState } from './browserPaneSeed';
import { useOpenedChrome } from './useOpenedChrome';
import { usePeekedLink } from './usePeekedLink';

const noop = () => undefined;

type Props = {
  readonly state: BrowserPaneSceneState;
  readonly theme: 'light' | 'dark';
};

export const BrowserPaneScene = ({ state, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useSceneRailFold({ isFolded: false });
  usePeekedLink({ isOn: isReady && state === 'peek' });
  useOpenedChrome({ isOn: isReady, state });
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedBrowserPane({ state });
    setIsReady(true);
  }, [state, theme]);
  if (!isReady) {
    return null;
  }
  return (
    <>
      <AppFrame view={state === 'page' ? 'browser' : 'session'} isRailCollapsed={false} hasPane />
      {state === 'keys' ? <PaletteOverlay initialQuery="dev" onClose={noop} /> : null}
      {state === 'cover' ? <BrowserCoverMenu /> : null}
    </>
  );
};
