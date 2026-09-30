import { detectRepoSlug } from '@goodboy/core';
import type {
  JiraIntegrationConfig,
  SessionExternalTaskProvider,
  WorkspaceId,
} from '@goodboy/types';
import { ghAssignedIssues, tauriGhRunner } from './github/github';
import { linearFetchAssignedIssues } from './linear/client';
import { gitlabFetchAssignedIssues } from './gitlab/client';
import { jiraListIssues } from './jira/client';
import { sentryFetchIssues, type SentryIssuesPage } from './sentry/client';
import { dedupById } from './sentry/SentryStudio/useSentryIssues';
import { slackThreadCandidates } from './slack/slackThreadCandidates';
import {
  githubIssueCandidate,
  gitlabIssueCandidate,
  jiraIssueCandidate,
  linearIssueCandidate,
  sentryIssueCandidate,
} from './issueCandidateOf';

export type IssueCandidate = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly goal: string;
  readonly body: string;
  readonly branchSlug: string;
  readonly sentryProject?: string;
};

type Params = {
  readonly provider: SessionExternalTaskProvider;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string | null;
  readonly gitlabHost: string | null;
  readonly jiraConfig: JiraIntegrationConfig | null;
  readonly sentryProjects?: ReadonlyArray<string>;
};

const EMPTY_SENTRY_PAGE: SentryIssuesPage = { issues: [], next_cursor: null };

export const fetchIssueCandidates = async ({
  provider,
  workspaceId,
  rootPath,
  gitlabHost,
  jiraConfig,
  sentryProjects = [],
}: Params): Promise<ReadonlyArray<IssueCandidate>> => {
  switch (provider) {
    case 'linear': {
      const issues = await linearFetchAssignedIssues(workspaceId);
      return issues.map(linearIssueCandidate);
    }
    case 'github': {
      if (rootPath == null) {
        return [];
      }
      const slug = await detectRepoSlug(tauriGhRunner, rootPath, workspaceId);
      if (slug == null) {
        throw new Error(
          'No GitHub repository resolved for this project, so there are no issues to list here.',
        );
      }
      const issues = await ghAssignedIssues(slug, { cwd: rootPath, workspaceId });
      return issues.map(githubIssueCandidate);
    }
    case 'gitlab': {
      if (gitlabHost == null) {
        return [];
      }
      const issues = await gitlabFetchAssignedIssues(workspaceId, gitlabHost);
      return issues.map(gitlabIssueCandidate);
    }
    case 'jira': {
      if (jiraConfig == null) {
        return [];
      }
      const issues = await jiraListIssues({
        workspaceId,
        siteUrl: jiraConfig.siteUrl,
        email: jiraConfig.email,
        projectKey: jiraConfig.projectKey,
        assignedOnly: true,
      });
      return issues.map(jiraIssueCandidate);
    }
    case 'sentry': {
      const [page, ...linkedPages] = await Promise.all([
        sentryFetchIssues(workspaceId),
        ...[...new Set(sentryProjects)].map((slug) =>
          sentryFetchIssues(workspaceId, undefined, undefined, undefined, slug).catch(
            () => EMPTY_SENTRY_PAGE,
          ),
        ),
      ]);
      const issues = [page, ...linkedPages].flatMap((entry) => entry.issues);
      return dedupById(issues).map(sentryIssueCandidate);
    }
    case 'slack': {
      return slackThreadCandidates({ workspaceId });
    }
    case 'bitbucket': {
      return [];
    }
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
};
