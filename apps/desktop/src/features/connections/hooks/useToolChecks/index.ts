import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useToolChecks = ({ workspaceId }: Params): string | null => {
  const checkTools = useAppStore((state) => state.checkTools);
  const [error, setError] = useState<string | null>(null);
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
    checkTools({ workspaceId }).then(
      () => setError(null),
      (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [workspaceId, bindingsKey, checkTools]);

  return error;
};
