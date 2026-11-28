import { useCallback } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BoardShellScene } from '../BoardShellScene';
import { openSessionsPopover } from '../sessions/columnScripts';
import { useSceneScript } from '../sessions/useSceneScript';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const NavDocsScene = ({ theme }: Props) => {
  const afterSeed = useCallback(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  useSceneScript({ isReady: true, run: openSessionsPopover });
  return <BoardShellScene afterSeed={afterSeed} />;
};
