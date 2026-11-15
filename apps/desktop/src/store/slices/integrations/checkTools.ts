import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import { integrationCredentialHasSecret } from '../../../features/integrations/credentials';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { ToolCheck, ToolCheckResult } from './state';
import { toolCheckKey } from './toolCheckKey';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isForced?: boolean;
};

type DepsParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Job = {
  readonly key: string;
  readonly request: () => Promise<ToolCheckResult>;
};

type FreshParams = {
  readonly check: ToolCheck | undefined;
  readonly nowMs: number;
};

type WriteParams = {
  readonly key: string;
  readonly check: ToolCheck;
};

type SecretParams = {
  readonly credentialId: IntegrationCredentialId;
};

const CHECK_INTERVAL_MS = 60_000;

const isFresh = ({ check, nowMs }: FreshParams): boolean =>
  check !== undefined &&
  (check.isChecking ||
    (check.checkedAtMs !== null && nowMs - check.checkedAtMs < CHECK_INTERVAL_MS));

const secretResult = async ({ credentialId }: SecretParams): Promise<ToolCheckResult> =>
  (await integrationCredentialHasSecret({ credentialId })) ? 'ok' : 'key-missing';

export const checkTools = ({ set, get }: DepsParams) => {
  const latest = createLatestOnly();
  const write = ({ key, check }: WriteParams) =>
    set((state) => ({ toolLastCheck: { ...state.toolLastCheck, [key]: check } }));
  const runOne = async ({ key, request }: Job): Promise<void> => {
    const claimed = latest.claim({ key });
    const previous = get().toolLastCheck[key];
    write({
      key,
      check: {
        result: previous?.result ?? null,
        checkedAtMs: previous?.checkedAtMs ?? null,
        isChecking: true,
      },
    });
    const result = await request().then(
      (value) => value,
      (): ToolCheckResult => 'failed',
    );
    if (!claimed.isCurrent()) {
      return;
    }
    write({ key, check: { result, checkedAtMs: Date.now(), isChecking: false } });
  };
  return async ({ workspaceId, isForced = false }: Params): Promise<void> => {
    const nowMs = Date.now();
    const github: Job = {
      key: toolCheckKey({ workspaceId, tool: 'github' }),
      request: async () => {
        await get().refreshGithubConnection({ workspaceId });
        return get().githubWorkspaceStatus[workspaceId] == null ? 'failed' : 'ok';
      },
    };
    const keyed = (get().workspaceIntegrations[workspaceId] ?? []).flatMap(
      (binding): ReadonlyArray<Job> => {
        const { credentialId } = binding;
        if (binding.provider === 'github' || credentialId == null) {
          return [];
        }
        return [
          {
            key: toolCheckKey({ workspaceId, tool: binding.provider }),
            request: () => secretResult({ credentialId }),
          },
        ];
      },
    );
    const jobs = [github, ...keyed].filter(
      (job) => isForced || !isFresh({ check: get().toolLastCheck[job.key], nowMs }),
    );
    await Promise.all(jobs.map(runOne));
  };
};
