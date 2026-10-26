import type { GithubIssue, PullRequestState } from '@goodboy/types';
import { titleBranchSlug } from '../../shared/utils/issueBranchSlug';
import { goalFromIssue as goalFromGithubIssue } from './github/githubGoalFromIssue';
import { goalFromPullRequest as goalFromGithubPullRequest } from './github/githubGoalFromPullRequest';
import { githubBranchSlug } from './github/components/PullRequest/githubBranchSlug';
import type { IssueCandidate } from './fetchIssueCandidates';
import type { LinearIssue } from './linear/client';
import { goalFromIssue as goalFromLinearIssue } from './linear/linearGoalFromIssue';
import { issueIdentifier, type GitlabIssue } from './gitlab/client';
import { goalFromIssue as goalFromGitlabIssue } from './gitlab/gitlabGoalFromIssue';
import { gitlabBranchSlug } from './gitlab/MergeRequest/gitlabBranchSlug';
import type { JiraIssue } from './jira/client';
import { goalFromIssue as goalFromJiraIssue } from './jira/jiraGoalFromIssue';
import { jiraBranchSlug } from './jira/JiraStudio/jiraBranchSlug';
import type { SentryIssue } from './sentry/client';
import { goalFromSentry } from './sentry/goalFromSentry';

const SENTRY_SLUG_MAX_LEN = 30;

export const linearIssueCandidate = (issue: LinearIssue): IssueCandidate => ({
  provider: 'linear',
  externalId: issue.id,
  identifier: issue.identifier,
  title: issue.title,
  url: issue.url,
  goal: goalFromLinearIssue({ issue }),
  body: issue.description ?? '',
  branchSlug: titleBranchSlug({ title: issue.title }),
});

export const githubIssueCandidate = (issue: GithubIssue): IssueCandidate => ({
  provider: 'github',
  externalId: String(issue.number),
  identifier: `#${issue.number}`,
  title: issue.title,
  url: issue.url,
  goal: goalFromGithubIssue({ issue }),
  body: issue.body,
  branchSlug: githubBranchSlug({ issue }),
});

export const githubPullRequestCandidate = (pr: PullRequestState): IssueCandidate => ({
  provider: 'github',
  externalId: String(pr.number),
  identifier: `#${pr.number}`,
  title: pr.title,
  url: pr.url,
  goal: goalFromGithubPullRequest({ pr }),
  body: pr.body,
  branchSlug: titleBranchSlug({ title: pr.title }),
});

export const gitlabIssueCandidate = (issue: GitlabIssue): IssueCandidate => ({
  provider: 'gitlab',
  externalId: String(issue.id),
  identifier: issueIdentifier(issue),
  title: issue.title,
  url: issue.webUrl,
  goal: goalFromGitlabIssue({ issue }),
  body: issue.description ?? '',
  branchSlug: gitlabBranchSlug({ issue }),
});

export const jiraIssueCandidate = (issue: JiraIssue): IssueCandidate => ({
  provider: 'jira',
  externalId: issue.id,
  identifier: issue.key,
  title: issue.summary,
  url: issue.url,
  goal: goalFromJiraIssue({ issue }),
  body: issue.description,
  branchSlug: jiraBranchSlug({ issue }),
});

export const sentryIssueCandidate = (issue: SentryIssue): IssueCandidate => {
  const goal = goalFromSentry({ issue });
  return {
    provider: 'sentry',
    externalId: issue.id,
    identifier: issue.shortId ?? issue.id,
    title: issue.title,
    url: issue.permalink ?? '',
    goal,
    body: goal,
    branchSlug: titleBranchSlug({ title: issue.title, maxLength: SENTRY_SLUG_MAX_LEN }),
    ...(issue.project?.slug != null && { sentryProject: issue.project.slug }),
  };
};
