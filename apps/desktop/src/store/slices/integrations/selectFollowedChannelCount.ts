import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'workspaceIntegrations'>;
  readonly workspaceId: WorkspaceId;
};

export const selectFollowedChannelCount = ({ state, workspaceId }: Params): number | null => {
  const slack = state.workspaceIntegrations[workspaceId]?.find(
    (binding) => binding.provider === 'slack' && binding.projectId === null,
  );
  if (slack === undefined || slack.provider !== 'slack') {
    return null;
  }
  return slack.config.followedChannels.length;
};
