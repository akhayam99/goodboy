import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type {
  GitlabWorkspaceIntegration,
  SessionExternalTaskProvider,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { fetchIssueCandidates, type IssueCandidate } from '../../fetchIssueCandidates';
import { useJiraConfig } from '../../jira/useJiraConfig';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
};

type Result = {
  readonly rows: ReadonlyArray<IssueCandidate>;
  readonly isLoading: boolean;
  readonly isLoaded: boolean;
  readonly error: string | null;
  readonly load: () => void;
};

const EMPTY_ROWS: ReadonlyArray<IssueCandidate> = [];

export const useIssueCandidates = ({ workspaceId, provider }: Params): Result => {
  const rootPath = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.sessionsRoot ?? null,
  );
  const gitlabHost = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (entry): entry is GitlabWorkspaceIntegration => entry.provider === 'gitlab',
    );
    return integration?.config.host ?? null;
  });
  const jiraConfig = useJiraConfig({ workspaceId });
  const [byProvider, setByProvider] = useState<
    Readonly<Record<string, ReadonlyArray<IssueCandidate>>>
  >({});
  const [loadingProvider, setLoadingProvider] = useState<SessionExternalTaskProvider | null>(null);
  const [errorByProvider, setErrorByProvider] = useState<Readonly<Record<string, string>>>({});

  const load = useCallback(() => {
    if (byProvider[provider] != null || loadingProvider === provider) {
      return;
    }
    setLoadingProvider(provider);
    setErrorByProvider((current) => {
      const next = { ...current };
      delete next[provider];
      return next;
    });
    void fetchIssueCandidates({ provider, workspaceId, rootPath, gitlabHost, jiraConfig })
      .then((rows) => {
        setByProvider((current) => ({ ...current, [provider]: rows }));
      })
      .catch((cause: unknown) => {
        setErrorByProvider((current) => ({ ...current, [provider]: formatError(cause) }));
      })
      .finally(() => {
        setLoadingProvider((current) => (current === provider ? null : current));
      });
  }, [byProvider, gitlabHost, jiraConfig, loadingProvider, provider, rootPath, workspaceId]);

  return {
    rows: byProvider[provider] ?? EMPTY_ROWS,
    isLoading: loadingProvider === provider,
    isLoaded: byProvider[provider] != null,
    error: errorByProvider[provider] ?? null,
    load,
  };
};
