import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';
import { WORKSPACE_ID } from '../BoardScene';
import { seedPolicyScene } from '../providerPolicySeed';
import { ThemedScene } from '../u37/ThemedScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

const openConnections = (): void => {
  seedPolicyScene({ workspaceId: WORKSPACE_ID });
  useAppStore.getState().openStudio({ studio: { kind: 'connections' } });
};

export const ConnectionsDoorScene = ({ theme }: Props) => (
  <ThemedScene theme={theme}>
    <BoardShellScene afterSeed={openConnections} />
  </ThemedScene>
);
