import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import { toError } from '../../../shared/utils/toError';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import type { GetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isForced?: boolean;
};

type FreshParams = {
  readonly get: GetFn;
  readonly credentialId: IntegrationCredentialId;
  readonly nowMs: number;
};

type CheckResult = {
  readonly message: string | null;
};

type ErrorsParams = CheckResult & {
  readonly errors: Readonly<Record<WorkspaceId, string>>;
  readonly workspaceId: WorkspaceId;
};

const CHECK_INTERVAL_MS = 60_000;

const TOOL_CHECKS = createLatestOnly();

const isFresh = ({ get, credentialId, nowMs }: FreshParams): boolean => {
  const check = get().integrationKeyChecks[credentialId];
  return check !== undefined && nowMs - check.checkedAt < CHECK_INTERVAL_MS;
};

const withCheckError = ({
  errors,
  workspaceId,
  message,
}: ErrorsParams): Readonly<Record<WorkspaceId, string>> => {
  if (message !== null) {
    return { ...errors, [workspaceId]: message };
  }
  if (errors[workspaceId] === undefined) {
    return errors;
  }
  const { [workspaceId]: _cleared, ...rest } = errors;
  return rest;
};

export const checkTools = ({ set, get }: SliceDeps) => {
  return async ({ workspaceId, isForced = false }: Params): Promise<void> => {
    const nowMs = Date.now();
    const credentialIds = (get().workspaceIntegrations[workspaceId] ?? []).flatMap((binding) =>
      binding.provider === 'github' || binding.credentialId == null ? [] : [binding.credentialId],
    );
    const due = credentialIds.filter(
      (credentialId) => isForced || !isFresh({ get, credentialId, nowMs }),
    );
    await TOOL_CHECKS.run({
      key: workspaceId,
      request: async (): Promise<CheckResult> => {
        const results = await Promise.allSettled([
          get().refreshGithubConnection({ workspaceId }),
          ...due.map((credentialId) => get().checkIntegrationKey({ credentialId })),
        ]);
        const failure = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        return {
          message: failure === undefined ? null : toError({ value: failure.reason }).message,
        };
      },
      apply: ({ message }: CheckResult) =>
        set((state) => ({
          toolCheckErrors: withCheckError({ errors: state.toolCheckErrors, workspaceId, message }),
        })),
    });
  };
};
