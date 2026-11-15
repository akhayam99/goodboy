import { useCallback } from 'react';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';
import { WORKSPACE_ID } from '../BoardScene';
import { ThemedScene } from '../u37/ThemedScene';
import { seedConnectionsIndex, type ConnectionsIndexVariant } from './connectionsIndexSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly variant: ConnectionsIndexVariant;
};

export const ConnectionsIndexScene = ({ theme, variant }: Props) => {
  const openConnections = useCallback(() => {
    seedConnectionsIndex({ workspaceId: WORKSPACE_ID, variant });
    useAppStore.getState().openStudio({ studio: { kind: 'connections' } });
  }, [variant]);

  return (
    <ThemedScene theme={theme}>
      <BoardShellScene afterSeed={openConnections} />
    </ThemedScene>
  );
};
