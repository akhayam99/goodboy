import { useCallback } from 'react';
import { brandId, type SessionId } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';
import { openSessionsPopover } from '../sessions/columnScripts';
import { useSceneScript } from '../sessions/useSceneScript';

type Props = {
  readonly theme: 'dark' | 'light';
};

const DESK_SESSION = brandId<SessionId>({ value: 'mock-board-session-checkout-retry' });

export const NavDocsScene = ({ theme }: Props) => {
  const afterSeed = useCallback(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState((state) => ({
      sessionFace: { ...state.sessionFace, [DESK_SESSION]: 'desk' },
    }));
  }, [theme]);
  useSceneScript({ isReady: true, run: openSessionsPopover });
  return <BoardShellScene afterSeed={afterSeed} />;
};
