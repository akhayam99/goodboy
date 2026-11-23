import { useCallback } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly hasUpdate: boolean;
};

const VERSION = '0.40.1';

export const LogoFootScene = ({ theme, hasUpdate }: Props) => {
  const afterSeed = useCallback(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState({
      updaterStatus: hasUpdate ? 'ready' : 'idle',
      updateVersion: hasUpdate ? VERSION : null,
      updateNotes: null,
      updateFailure: null,
      updateProgress: null,
      updateQueuedUntilIdle: false,
    });
  }, [theme, hasUpdate]);

  return <BoardShellScene afterSeed={afterSeed} />;
};
