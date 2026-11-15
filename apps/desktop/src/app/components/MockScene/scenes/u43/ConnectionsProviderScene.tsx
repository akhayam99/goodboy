import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';
import { ThemedScene } from '../u37/ThemedScene';
import { seedConnectionsProviders } from './connectionsProviderSeed';

type Props = {
  readonly provider: ProviderId;
  readonly theme: 'dark' | 'light';
};

export const ConnectionsProviderScene = ({ provider, theme }: Props) => (
  <ThemedScene theme={theme}>
    <BoardShellScene
      afterSeed={() => {
        seedConnectionsProviders();
        useAppStore.getState().openStudio({ studio: { kind: 'connections', focus: { provider } } });
      }}
    />
  </ThemedScene>
);
