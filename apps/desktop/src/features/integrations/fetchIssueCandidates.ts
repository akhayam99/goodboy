import { detectRepoSlug } from '@goodboy/core';
import type {
  JiraIntegrationConfig,
  SessionExternalTaskProvider,
  WorkspaceId,
} from '@goodboy/types';
import { slugifyBranch } from '../../shared/utils/slugifyBranch';
import { ghAssignedIssues, tauriGhRunner } from '../github/github';
import { goalFromIssue as goalFromGithubIssue } from '../github/goal-from-issue';
import { githubBranchSlug } from '../github/components/GitHubStudio/useGithubIssues';
import { linearFetchAssignedIssues } from './linear/client';
import { goalFromIssue as goalFromLinearIssue } from './linear/goal-from-issue';
import { gitlabFetchAssignedIssues, issueIdentifier } from './gitlab/client';
import { goalFromIssue as goalFromGitlabIssue } from './gitlab/goal-from-issue';
import { gitlabBranchSlug } from './gitlab/GitlabStudio/useGitlabIssues';
import { jiraListIssues } from './jira/client';
import { goalFromIssue as goalFromJiraIssue } from './jira/goal-from-issue';
import { jiraBranchSlug } from './jira/JiraStudio/useJiraIssues';
import { sentryFetchIssues } from './sentry/client';
import { goalFromSentry } from './sentry/goal-from-sentry';

export type IssueCandidate = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly goal: string;
  readonly branchSlug: string;
};

type Params = {
  readonly provider: SessionExternalTaskProvider;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string | null;
  readonly gitlabHost: string | null;
  readonly jiraConfig: JiraIntegrationConfig | null;
};

const SENTRY_SLUG_MAX_LEN = 30;

export const fetchIssueCandidates = async ({
  provider,
  workspaceId,
  rootPath,
  gitlabHost,
  jiraConfig,
}: Params): Promise<ReadonlyArray<IssueCandidate>> => {
  switch (provider) {
    case 'linear': {
      const issues = await linearFetchAssignedIssues(workspaceId);
      return issues.map((issue) => ({
        provider,
        externalId: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        goal: goalFromLinearIssue(issue),
        branchSlug: slugifyBranch({ input: issue.title, maxLength: 48 }),
      }));
    }
    case 'github': {
      if (rootPath == null) {
        return [];
      }
      const slug = await detectRepoSlug(tauriGhRunner, rootPath, workspaceId);
      if (slug == null) {
        return [];
      }
      const issues = await ghAssignedIssues(slug, { cwd: rootPath, workspaceId });
      return issues.map((issue) => ({
        provider,
        externalId: String(issue.number),
        identifier: `#${issue.number}`,
        title: issue.title,
        url: issue.url,
        goal: goalFromGithubIssue({ issue }),
        branchSlug: githubBranchSlug({ issue }),
      }));
    }
    case 'gitlab': {
      if (gitlabHost == null) {
        return [];
      }
      const issues = await gitlabFetchAssignedIssues(workspaceId, gitlabHost);
      return issues.map((issue) => ({
        provider,
        externalId: String(issue.id),
        identifier: issueIdentifier(issue),
        title: issue.title,
        url: issue.webUrl,
        goal: goalFromGitlabIssue(issue),
        branchSlug: gitlabBranchSlug(issue),
      }));
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
      return issues.map((issue) => ({
        provider,
        externalId: issue.id,
        identifier: issue.key,
        title: issue.summary,
        url: issue.url,
        goal: goalFromJiraIssue({ issue }),
        branchSlug: jiraBranchSlug({ issue }),
      }));
    }
    case 'sentry': {
      const page = await sentryFetchIssues(workspaceId);
      return page.issues.map((issue) => ({
        provider,
        externalId: issue.id,
        identifier: issue.shortId ?? issue.id,
        title: issue.title,
        url: issue.permalink ?? '',
        goal: goalFromSentry(issue),
        branchSlug: slugifyBranch({ input: issue.title, maxLength: SENTRY_SLUG_MAX_LEN }),
      }));
    }
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
};
