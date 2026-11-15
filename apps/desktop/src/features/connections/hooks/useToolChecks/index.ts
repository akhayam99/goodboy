import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useToolChecks = ({ workspaceId }: Params): void => {
  const checkTools = useAppStore((state) => state.checkTools);
  const bindingsKey = useAppStore((state) =>
    workspaceId === null
      ? ''
      : (state.workspaceIntegrations[workspaceId] ?? [])
          .map((binding) => `${binding.id}:${binding.credentialId ?? ''}`)
          .join('|'),
  );

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    void checkTools({ workspaceId });
  }, [workspaceId, bindingsKey, checkTools]);
};
