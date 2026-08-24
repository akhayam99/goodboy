import { useEffect, useMemo, useRef, useState } from 'react';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { primaryProjectRoot } from '../../../workspace/primaryProjectRoot';
import {
  fetchIssueCandidates,
  type IssueCandidate,
} from '../../../integrations/fetchIssueCandidates';
import { resolveIssueSources } from '../../../integrations/issueSources';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { useJiraConfig } from '../../../integrations/jira/useJiraConfig';

const ROWS_PER_SOURCE = 5;

type Params = {
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly hasSources: boolean;
  readonly rows: ReadonlyArray<IssueCandidate>;
  readonly isLoading: boolean;
};

export const useKickoffIssues = ({ workspaceId }: Params): Result => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const github = useGithubConnection({ workspaceId });
  const rootPath = useAppStore((state) =>
    primaryProjectRoot({ projects: state.projects, workspaceId }),
  );
  const gitlabHost = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (entry): entry is GitlabIntegrationBinding => entry.provider === 'gitlab',
    );
    return integration?.config.host ?? null;
  });
  const jiraConfig = useJiraConfig({ workspaceId });
  const externalTasks = useAppStore((state) => state.sessionExternalTasks);
  const [rowsByProvider, setRowsByProvider] = useState<
    Readonly<Record<string, ReadonlyArray<IssueCandidate>>>
  >({});
  const [pendingCount, setPendingCount] = useState(0);
  const fetchedRef = useRef(new Set<string>());

  const sources = useMemo(
    () =>
      resolveIssueSources({
        integrations,
        isGithubAuthenticated: github.isAuthenticated,
      }).filter((source) => source.provider !== 'slack'),
    [github.isAuthenticated, integrations],
  );

  useEffect(() => {
    for (const source of sources) {
      if (fetchedRef.current.has(source.provider)) {
        continue;
      }
      fetchedRef.current.add(source.provider);
      setPendingCount((count) => count + 1);
      void fetchIssueCandidates({
        provider: source.provider,
        workspaceId,
        rootPath,
        gitlabHost,
        jiraConfig,
      })
        .then((rows) => {
          setRowsByProvider((current) => ({ ...current, [source.provider]: rows }));
        })
        .catch(() => undefined)
        .finally(() => {
          setPendingCount((count) => count - 1);
        });
    }
  }, [gitlabHost, jiraConfig, rootPath, sources, workspaceId]);

  const linkedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const tasks of Object.values(externalTasks)) {
      for (const task of tasks) {
        keys.add(`${task.provider}:${task.externalId}`);
      }
    }
    return keys;
  }, [externalTasks]);

  const rows = useMemo(
    () =>
      sources.flatMap((source) =>
        (rowsByProvider[source.provider] ?? [])
          .filter((row) => !linkedKeys.has(`${row.provider}:${row.externalId}`))
          .slice(0, ROWS_PER_SOURCE),
      ),
    [linkedKeys, rowsByProvider, sources],
  );

  return {
    hasSources: sources.length > 0,
    rows,
    isLoading: pendingCount > 0,
  };
};
