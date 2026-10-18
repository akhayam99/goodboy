import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { FoldersHomeScene } from './FoldersHomeScene';
import { FoldersSettingsScene } from './FoldersSettingsScene';

export type FoldersSceneState = 'home' | 'settings';

type Props = {
  readonly state: FoldersSceneState;
  readonly theme: 'dark' | 'light';
};

export const FoldersScene = ({ state, theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);

  return state === 'home' ? <FoldersHomeScene /> : <FoldersSettingsScene />;
};
