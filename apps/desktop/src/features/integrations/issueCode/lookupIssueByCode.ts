import type { JiraIntegrationConfig, SessionId, WorkspaceId } from '@goodboy/types';
import { ghIssueInRepo } from '../../github/github';
import { adaptGithubIssues } from '../../inbox/adapters/github';
import { adaptGitlab } from '../../inbox/adapters/gitlab';
import { adaptJiraIssues } from '../../inbox/adapters/jira';
import { adaptLinearIssues } from '../../inbox/adapters/linear';
import { adaptSentryIssues } from '../../inbox/adapters/sentry';
import type { InboxRecord } from '../../inbox/types';
import type { IssueCandidate } from '../fetchIssueCandidates';
import { gitlabFetchIssue } from '../gitlab/client';
import {
  githubIssueCandidate,
  gitlabIssueCandidate,
  jiraIssueCandidate,
  linearIssueCandidate,
  sentryIssueCandidate,
} from '../issueCandidateOf';
import { jiraGetIssue } from '../jira/client';
import { buildIssueGroups as buildJiraGroups } from '../jira/JiraStudio/useJiraIssues';
import { linearFetchIssue } from '../linear/client';
import { buildIssueGroups as buildLinearGroups } from '../linear/LinearStudio/useLinearIssues';
import { sentryFetchIssue, sentryResolveShortId } from '../sentry/client';
import { classifyLookupError, type LookupFailure } from './classifyLookupError';
import type { LookupTarget } from './routeIssueCode';

const GITHUB_PARALLEL = 4;

export type LookupHit = {
  readonly target: LookupTarget;
  readonly candidate: IssueCandidate;
  readonly record: InboxRecord;
};

export type LookupMiss = {
  readonly target: LookupTarget;
  readonly failure: LookupFailure;
};

export type LookupResult = {
  readonly hits: ReadonlyArray<LookupHit>;
  readonly misses: ReadonlyArray<LookupMiss>;
};

export type LookupDeps = {
  readonly workspaceId: WorkspaceId;
  readonly gitlabHost: string | null;
  readonly jiraConfig: JiraIntegrationConfig | null;
};

const EMPTY_SESSIONS: ReadonlyMap<string, SessionId> = new Map();

const hitOf = async (target: LookupTarget, deps: LookupDeps): Promise<LookupHit> => {
  const { workspaceId } = deps;
  switch (target.provider) {
    case 'linear': {
      const issue = await linearFetchIssue({ workspaceId, issueId: target.identifier });
      const [record] = adaptLinearIssues({ groups: buildLinearGroups([issue], EMPTY_SESSIONS) });
      if (record === undefined) {
        throw new Error('not found');
      }
      return { target, candidate: linearIssueCandidate(issue), record };
    }
    case 'jira': {
      if (deps.jiraConfig === null) {
        throw new Error('unauthorized');
      }
      const issue = await jiraGetIssue({
        workspaceId,
        siteUrl: deps.jiraConfig.siteUrl,
        email: deps.jiraConfig.email,
        issueKey: target.key,
      });
      const [record] = adaptJiraIssues({
        groups: buildJiraGroups({ issues: [issue], sessionIdByExternalId: EMPTY_SESSIONS }),
      });
      if (record === undefined) {
        throw new Error('not found');
      }
      return { target, candidate: jiraIssueCandidate(issue), record };
    }
    case 'github': {
      const issue = await ghIssueInRepo({
        repo: target.repo,
        issueNumber: target.number,
        workspaceId,
      });
      const [record] = adaptGithubIssues({
        groups: [{ key: target.repo, label: target.repo, rows: [{ issue, sessionId: null }] }],
      });
      if (record === undefined) {
        throw new Error('not found');
      }
      return {
        target,
        candidate: githubIssueCandidate(issue),
        record: {
          ...record,
          key: `github:issue:${target.repo}#${issue.number}`,
          identifier: `${target.repo.split('/').at(-1) ?? target.repo} #${issue.number}`,
        },
      };
    }
    case 'gitlab': {
      if (deps.gitlabHost === null) {
        throw new Error('unauthorized');
      }
      const issue = await gitlabFetchIssue(
        workspaceId,
        deps.gitlabHost,
        target.projectPath,
        target.iid,
      );
      const [record] = adaptGitlab({
        issueGroups: [
          {
            key: target.projectPath,
            label: target.projectPath,
            rows: [{ issue, sessionId: null }],
          },
        ],
        mrGroups: [],
        host: deps.gitlabHost,
      });
      if (record === undefined) {
        throw new Error('not found');
      }
      return { target, candidate: gitlabIssueCandidate(issue), record };
    }
    case 'sentry':
    case 'sentry-id': {
      const issue =
        target.provider === 'sentry'
          ? await sentryResolveShortId({ workspaceId, shortId: target.shortId })
          : await sentryFetchIssue({ workspaceId, issueId: target.issueId });
      const [record] = adaptSentryIssues({ rows: [{ issue, sessionId: null }] });
      if (record === undefined) {
        throw new Error('not found');
      }
      return { target, candidate: sentryIssueCandidate(issue), record };
    }
  }
};

type Settled = { readonly hit: LookupHit } | { readonly miss: LookupMiss };

const settle = async (target: LookupTarget, deps: LookupDeps): Promise<Settled> => {
  try {
    return { hit: await hitOf(target, deps) };
  } catch (error) {
    return { miss: { target, failure: classifyLookupError(error) } };
  }
};

const inBatches = async (
  targets: ReadonlyArray<LookupTarget>,
  deps: LookupDeps,
): Promise<ReadonlyArray<Settled>> => {
  const github = targets.filter((target) => target.provider === 'github');
  const others = targets.filter((target) => target.provider !== 'github');
  const settled: Settled[] = [...(await Promise.all(others.map((target) => settle(target, deps))))];
  for (let index = 0; index < github.length; index += GITHUB_PARALLEL) {
    const batch = github.slice(index, index + GITHUB_PARALLEL);
    settled.push(...(await Promise.all(batch.map((target) => settle(target, deps)))));
  }
  return settled;
};

type Params = LookupDeps & {
  readonly targets: ReadonlyArray<LookupTarget>;
};

export const lookupIssueByCode = async ({ targets, ...deps }: Params): Promise<LookupResult> => {
  const settled = await inBatches(targets, deps);
  return {
    hits: settled.flatMap((entry) => ('hit' in entry ? [entry.hit] : [])),
    misses: settled.flatMap((entry) => ('miss' in entry ? [entry.miss] : [])),
  };
};
