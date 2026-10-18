import { useEffect, useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  fetchIssueCandidates,
  type IssueCandidate,
} from '../../../integrations/fetchIssueCandidates';
import { resolveIssueSources, type IssueSourceKind } from '../../../integrations/issueSources';
import { useJiraConfig } from '../../../integrations/jira/useJiraConfig';
import { useToolConnections } from '../../../integrations/useToolConnections';
import { primaryProjectRoot } from '../../../workspace/primaryProjectRoot';

const ISSUES_SHOWN = 3;

const SOURCE_KINDS: ReadonlyArray<IssueSourceKind> = ['issue'];

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type FirstIssues = {
  readonly hasSources: boolean;
  readonly isLoaded: boolean;
  readonly rows: ReadonlyArray<IssueCandidate>;
  readonly failure: string | null;
};

export const useFirstIssues = ({ workspaceId }: Params): FirstIssues => {
  const { integrations, github } = useToolConnections({ workspaceId });
  const rootPath = useAppStore((state) =>
    primaryProjectRoot({ projects: state.projects, workspaceId }),
  );
  const gitlabHost = useAppStore((state) => {
    const binding = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (entry): entry is GitlabIntegrationBinding => entry.provider === 'gitlab',
    );
    return binding?.config.host ?? null;
  });
  const jiraConfig = useJiraConfig({ workspaceId });
  const sources = useMemo(
    () =>
      resolveIssueSources({
        integrations,
        isGithubAuthenticated: github.isAuthenticated,
        kinds: SOURCE_KINDS,
      }),
    [github.isAuthenticated, integrations],
  );
  const [rows, setRows] = useState<ReadonlyArray<IssueCandidate>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    setIsLoaded(false);
    void Promise.allSettled(
      sources.map((source) =>
        fetchIssueCandidates({
          provider: source.provider,
          workspaceId,
          rootPath,
          gitlabHost,
          jiraConfig,
        }),
      ),
    ).then((results) => {
      if (isDisposed) {
        return;
      }
      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      const lists = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      setRows(lists.flat().slice(0, ISSUES_SHOWN));
      setFailure(lists.length === 0 && failed !== undefined ? formatError(failed.reason) : null);
      setIsLoaded(true);
    });
    return () => {
      isDisposed = true;
    };
  }, [gitlabHost, jiraConfig, rootPath, sources, workspaceId]);

  return { hasSources: sources.length > 0, isLoaded, rows, failure };
};
