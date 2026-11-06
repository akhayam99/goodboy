import { useCallback } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { BoardScene, seedBoardScene } from '../BoardScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const BoardFactsScene = ({ theme }: Props) => {
  const seed = useCallback(() => {
    applyDocumentTheme({ theme });
    seedBoardScene();
    useAppStore.setState({
      workspaceFactsError: 'database is locked',
      retryWorkspaceFacts: async () => undefined,
    });
  }, [theme]);
  return <BoardScene seed={seed} />;
};
