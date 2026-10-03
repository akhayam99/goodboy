import { useCallback, useState } from 'react';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { autoLimitContext } from '../../../../store/slices/providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import { polishWorkflowGuidanceText } from '../../workflows';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir?: string | null;
};

export const usePolishGuidance = ({ workspaceId, workingDir = null }: Params) => {
  const [isPolishing, setIsPolishing] = useState(false);
  const polish = useCallback(
    async (guidance: string): Promise<string | null> => {
      const state = useAppStore.getState();
      const overrides = state.workspaceOverrides[workspaceId];
      const deps = resolveLimitedTaskModel({
        limitContext: autoLimitContext({ state }),
        task: 'prose_polish',
        preferences: overrides?.taskModels,
        workspaceDefaultProviderId: overrides?.defaultProviderId,
        sessionDefaultProviderId: DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
      });
      setIsPolishing(true);
      try {
        return await polishWorkflowGuidanceText({
          deps: { ...deps, ...(workingDir !== null && { workingDir }) },
          guidance,
        });
      } finally {
        setIsPolishing(false);
      }
    },
    [workingDir, workspaceId],
  );
  return { polish, isPolishing };
};
