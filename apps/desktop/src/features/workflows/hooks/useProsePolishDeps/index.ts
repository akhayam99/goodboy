import { useMemo } from 'react';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE, type StepPolishDeps } from '@goodboy/core';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { resolveLimitedTaskModel } from '../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import { useAutoLimitContext } from '../../../providers/hooks/useAutoLimitContext';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
};

export const useProsePolishDeps = ({
  workspaceId,
  workingDir,
  connectedProviders,
}: Params): Omit<StepPolishDeps, 'invokeFn'> => {
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const limitContext = useAutoLimitContext();
  const taskModel = useMemo(
    () =>
      resolveLimitedTaskModel({
        limitContext,
        task: 'prose_polish',
        preferences: overrides?.taskModels,
        workspaceDefaultProviderId: overrides?.defaultProviderId,
        sessionDefaultProviderId:
          connectedProviders[0] ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
        connectedProviders: connectedProviders.length > 0 ? connectedProviders : null,
      }),
    [connectedProviders, limitContext, overrides],
  );
  return { ...taskModel, ...(workingDir !== null && { workingDir }) };
};
