import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isForced?: boolean;
};

type DepsParams = {
  readonly get: GetFn;
};

type FreshParams = {
  readonly get: GetFn;
  readonly credentialId: IntegrationCredentialId;
  readonly nowMs: number;
};

const CHECK_INTERVAL_MS = 60_000;

const isFresh = ({ get, credentialId, nowMs }: FreshParams): boolean => {
  const check = get().integrationKeyChecks[credentialId];
  return check !== undefined && nowMs - check.checkedAt < CHECK_INTERVAL_MS;
};

export const checkTools = ({ get }: DepsParams) => {
  return async ({ workspaceId, isForced = false }: Params): Promise<void> => {
    const nowMs = Date.now();
    const credentialIds = (get().workspaceIntegrations[workspaceId] ?? []).flatMap((binding) =>
      binding.provider === 'github' || binding.credentialId == null ? [] : [binding.credentialId],
    );
    const due = credentialIds.filter(
      (credentialId) => isForced || !isFresh({ get, credentialId, nowMs }),
    );
    const results = await Promise.allSettled([
      get().refreshGithubConnection({ workspaceId }),
      ...due.map((credentialId) => get().checkIntegrationKey({ credentialId })),
    ]);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure !== undefined) {
      throw failure.reason;
    }
  };
};
