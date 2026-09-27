import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { detectRepoSlug } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { tauriGhRunner } from '../../../github/github';
import { classifyRemoteHost, projectPathFromRemoteUrl } from '../../../../shared/lib/remoteHost';
import { worktreeRemoteUrl } from '../../../worktree/worktree';
import { lookupIssueByCode, type LookupResult } from '../../issueCode/lookupIssueByCode';
import { parseIssueCode } from '../../issueCode/parseIssueCode';
import {
  routeIssueCode,
  type LookupContext,
  type LookupProvider,
  type LookupRoute,
} from '../../issueCode/routeIssueCode';
import { useJiraConfig } from '../../jira/useJiraConfig';
import { useToolConnections } from '../../useToolConnections';
import { useIssueLookup, type IssueLookupState } from '../useIssueLookup';

export type WorkspaceLookup = {
  readonly route: LookupRoute;
  readonly result: LookupResult;
};

export type WorkspaceIssueLookup = {
  readonly code: string | null;
  readonly state: IssueLookupState<WorkspaceLookup>;
  readonly retry: () => void;
};

const EMPTY_RESULT: LookupResult = { hits: [], misses: [] };

type RepoRemote = {
  readonly github: string | null;
  readonly gitlab: string | null;
};

const remoteCache = new Map<string, Promise<RepoRemote>>();

const remoteOf = ({
  rootPath,
  workspaceId,
  gitlabHost,
}: {
  readonly rootPath: string;
  readonly workspaceId: WorkspaceId;
  readonly gitlabHost: string | null;
}): Promise<RepoRemote> => {
  const cacheKey = `${workspaceId}:${rootPath}`;
  const cached = remoteCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const pending = (async (): Promise<RepoRemote> => {
    const url = await worktreeRemoteUrl(rootPath).catch(() => null);
    if (classifyRemoteHost(url, gitlabHost === null ? [] : [gitlabHost]) === 'gitlab') {
      return { github: null, gitlab: projectPathFromRemoteUrl(url) };
    }
    const github = await detectRepoSlug(tauriGhRunner, rootPath, workspaceId).catch(() => null);
    return { github, gitlab: null };
  })();
  remoteCache.set(cacheKey, pending);
  return pending;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly query: string;
  readonly isKnown?: (code: string) => boolean;
  readonly immediate?: boolean;
};

export const useWorkspaceIssueLookup = ({
  workspaceId,
  query,
  isKnown,
  immediate = false,
}: Params): WorkspaceIssueLookup => {
  const [attempt, setAttempt] = useState(0);
  const { connected: toolConnected, integrations } = useToolConnections({ workspaceId });
  const jiraConfig = useJiraConfig({ workspaceId });
  const sentryLinks = useAppStore((state) => state.projectSentryLinks[workspaceId]);
  const roots = useAppStore(
    useShallow((state) =>
      state.projects
        .filter(
          (project) =>
            project.workspaceId === workspaceId &&
            project.kind === 'repo' &&
            project.disconnectedAt == null,
        )
        .map((project) => project.rootPath),
    ),
  );
  const gitlabHost = useMemo(() => {
    for (const binding of integrations) {
      if (binding.provider === 'gitlab') {
        return binding.config.host;
      }
    }
    return null;
  }, [integrations]);
  const sentryProjects = useMemo(() => {
    const configured = integrations.flatMap((binding) =>
      binding.provider === 'sentry' ? [binding.config.project] : [],
    );
    const linked = (sentryLinks ?? []).map((link) => link.sentryProject);
    return [...new Set([...configured, ...linked])];
  }, [integrations, sentryLinks]);
  const connected = useMemo(
    () =>
      new Set<LookupProvider>(
        (['linear', 'jira', 'github', 'gitlab', 'sentry'] as const).filter(
          (provider) => toolConnected[provider],
        ),
      ),
    [
      toolConnected.linear,
      toolConnected.jira,
      toolConnected.github,
      toolConnected.gitlab,
      toolConnected.sentry,
    ],
  );

  const parsed = parseIssueCode(query);
  const code =
    parsed.kind === 'key' || parsed.kind === 'shortId' ? parsed.code : query.trim().toUpperCase();
  const key = parsed.kind === 'text' || isKnown?.(code) === true ? null : `${code}#${attempt}`;

  const state = useIssueLookup<WorkspaceLookup>({
    key,
    scope: workspaceId,
    immediate,
    run: async () => {
      const needsRepos = parsed.kind === 'number';
      const remotes = needsRepos
        ? await Promise.all(
            roots.map((rootPath) => remoteOf({ rootPath, workspaceId, gitlabHost })),
          )
        : [];
      const context: LookupContext = {
        connected,
        jiraProjectKey: jiraConfig?.projectKey ?? null,
        sentryProjects,
        githubRepos: [
          ...new Set(remotes.flatMap((remote) => (remote.github === null ? [] : [remote.github]))),
        ],
        gitlabProjects: [
          ...new Set(remotes.flatMap((remote) => (remote.gitlab === null ? [] : [remote.gitlab]))),
        ],
      };
      const route = routeIssueCode(parsed, context);
      if (route.kind !== 'lookup') {
        return { route, result: EMPTY_RESULT };
      }
      const result = await lookupIssueByCode({
        targets: route.targets,
        workspaceId,
        gitlabHost,
        jiraConfig: jiraConfig ?? null,
      });
      return { route, result };
    },
  });
  return {
    code: key === null ? null : code,
    state,
    retry: () => setAttempt((current) => current + 1),
  };
};
