import { useCallback } from 'react';
import type { SlackIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useSlackConfigSave = ({ workspaceId }: Params) => {
  const updateSlackConfig = useAppStore((state) => state.updateSlackConfig);
  return useCallback(
    (config: SlackIntegrationConfig): void => {
      void updateSlackConfig({ workspaceId, config });
    },
    [updateSlackConfig, workspaceId],
  );
};
