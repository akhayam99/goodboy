import { useEffect, useMemo, useRef, useState } from 'react';
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
import { targetProvider } from '../../issueCode/lookupCopy';
import { useIssueLookup, type IssueLookupState } from '../useIssueLookup';
import { forgetTeamKeys, teamKeysOf } from './linearTeamKeys';

export type WorkspaceLookup = {
  readonly route: LookupRoute;
  readonly result: LookupResult;
};

export type WorkspaceIssueLookup = {
  readonly code: string | null;
  readonly state: IssueLookupState<WorkspaceLookup>;
  readonly loadingProviders: ReadonlyArray<LookupProvider>;
  readonly retryAt: number | null;
  readonly retry: () => void;
  readonly settled: LookupResult | null;
};

const RATE_LIMIT_RETRY_MS = 20_000;

const EMPTY_RESULT: LookupResult = { hits: [], misses: [] };
const EMPTY_PROVIDERS: ReadonlyArray<LookupProvider> = [];

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
  readonly providers?: ReadonlyArray<LookupProvider>;
};

export const useWorkspaceIssueLookup = ({
  workspaceId,
  query,
  isKnown,
  immediate = false,
  providers,
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
          (provider) =>
            toolConnected[provider] && (providers === undefined || providers.includes(provider)),
        ),
      ),
    [
      providers,
      toolConnected.linear,
      toolConnected.jira,
      toolConnected.github,
      toolConnected.gitlab,
      toolConnected.sentry,
    ],
  );

  const [linearTeamKeys, setLinearTeamKeys] = useState<ReadonlyArray<string> | null>(null);
  useEffect(() => {
    if (!connected.has('linear')) {
      forgetTeamKeys(workspaceId);
      setLinearTeamKeys(null);
      return;
    }
    let active = true;
    void teamKeysOf(workspaceId).then((keys) => {
      if (active) {
        setLinearTeamKeys(keys);
      }
    });
    return () => {
      active = false;
    };
  }, [connected, workspaceId]);

  const parsed = parseIssueCode(query);
  const code =
    parsed.kind === 'key' || parsed.kind === 'shortId' ? parsed.code : query.trim().toUpperCase();
  const key = parsed.kind === 'text' || isKnown?.(code) === true ? null : `${code}#${attempt}`;

  const previewRoute = routeIssueCode(parsed, {
    connected,
    jiraProjectKey: jiraConfig?.projectKey ?? null,
    sentryProjects,
    githubRepos: [],
    gitlabProjects: [],
    linearTeamKeys,
  });
  const loadingProviders =
    previewRoute.kind === 'lookup'
      ? [...new Set(previewRoute.targets.map((target) => targetProvider(target)))]
      : EMPTY_PROVIDERS;

  const [retryAt, setRetryAt] = useState<number | null>(null);
  const autoRetriedCodeRef = useRef<string | null>(null);

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
        linearTeamKeys,
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

  useEffect(() => {
    if (state.status !== 'done') {
      return;
    }
    const hasRateLimited = state.value.result.misses.some(
      (miss) => miss.failure === 'rate-limited',
    );
    if (!hasRateLimited) {
      setRetryAt(null);
      return;
    }
    if (autoRetriedCodeRef.current === code) {
      return;
    }
    autoRetriedCodeRef.current = code;
    setRetryAt(Date.now() + RATE_LIMIT_RETRY_MS);
    const timer = setTimeout(() => {
      setRetryAt(null);
      setAttempt((current) => current + 1);
    }, RATE_LIMIT_RETRY_MS);
    return () => clearTimeout(timer);
  }, [state, code]);

  return {
    code: key === null ? null : code,
    state,
    loadingProviders,
    retryAt,
    retry: () => setAttempt((current) => current + 1),
    settled: state.status === 'done' && state.key === key ? state.value.result : null,
  };
};
