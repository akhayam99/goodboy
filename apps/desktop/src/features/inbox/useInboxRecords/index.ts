import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useGithubIssues } from '../../github/components/GitHubStudio/useGithubIssues';
import { useBitbucketPrs } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import { useWorkspaceBitbucketRepo } from '../../integrations/bitbucket/useWorkspaceBitbucketRepo';
import { useGitlabIssues } from '../../integrations/gitlab/GitlabStudio/useGitlabIssues';
import { useGitlabMrs } from '../../integrations/gitlab/GitlabStudio/useGitlabMrs';
import { useJiraIssues } from '../../integrations/jira/JiraStudio/useJiraIssues';
import { useLinearIssues } from '../../integrations/linear/LinearStudio/useLinearIssues';
import { useSentryIssues } from '../../integrations/sentry/SentryStudio/useSentryIssues';
import { useSlackThreads } from '../../integrations/slack/SlackStudio/useSlackThreads';
import { adaptBitbucketPrs } from '../adapters/bitbucket';
import { adaptGithubIssues } from '../adapters/github';
import { adaptGitlab } from '../adapters/gitlab';
import { adaptJiraIssues } from '../adapters/jira';
import { adaptLinearIssues } from '../adapters/linear';
import { adaptSentryIssues } from '../adapters/sentry';
import { adaptSlackThreads } from '../adapters/slack';
import type { InboxProvider, InboxRecord } from '../types';

type Params = { readonly workspaceId: WorkspaceId; readonly rootPath: string };
type Errors = Readonly<Record<InboxProvider, string | null>>;
type Result = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly isLoading: boolean;
  readonly errors: Errors;
  readonly refetch: () => void;
  readonly connectedCount: number;
};

export const useInboxRecords = ({ workspaceId, rootPath }: Params): Result => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const has = (provider: InboxProvider): boolean =>
    provider === 'github' ? true : integrations.some((binding) => binding.provider === provider);
  const github = useGithubIssues({ workspaceId, rootPath, isEnabled: has('github') });
  const gitlabIssues = useGitlabIssues({ workspaceId, isEnabled: has('gitlab') });
  const gitlabMrs = useGitlabMrs({ workspaceId, isEnabled: has('gitlab') });
  const linear = useLinearIssues(workspaceId, has('linear'));
  const jira = useJiraIssues({ workspaceId, isEnabled: has('jira'), assignedOnly: true });
  const sentry = useSentryIssues(workspaceId, has('sentry'));
  const slack = useSlackThreads({ workspaceId, isEnabled: has('slack') });
  const bitbucketRepo = useWorkspaceBitbucketRepo({ workspaceId, isEnabled: has('bitbucket') });
  const bitbucket = useBitbucketPrs({ repo: bitbucketRepo });
  const records = useMemo(
    () =>
      [
        ...adaptGithubIssues({ groups: github.groups }),
        ...adaptGitlab({
          issueGroups: gitlabIssues.groups,
          mrGroups: gitlabMrs.groups,
          host: gitlabMrs.host,
        }),
        ...adaptLinearIssues({ groups: linear.groups }),
        ...adaptJiraIssues({ groups: jira.groups }),
        ...adaptSentryIssues({ rows: sentry.rows }),
        ...adaptSlackThreads({ groups: slack.groups }),
        ...adaptBitbucketPrs({ groups: bitbucket.groups, repo: bitbucketRepo }),
      ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [
      github.groups,
      gitlabIssues.groups,
      gitlabMrs.groups,
      gitlabMrs.host,
      linear.groups,
      jira.groups,
      sentry.rows,
      slack.groups,
      bitbucket.groups,
      bitbucketRepo,
    ],
  );
  const errors = {
    github: github.error,
    gitlab: gitlabIssues.error ?? gitlabMrs.error,
    linear: linear.error,
    jira: jira.error,
    sentry: sentry.error,
    slack: slack.error,
    bitbucket: bitbucket.error,
  } satisfies Errors;
  const refetch = (): void => {
    github.refetch();
    gitlabIssues.refetch();
    gitlabMrs.refetch();
    linear.refetch();
    jira.refetch();
    sentry.refetch();
    slack.refetch();
    bitbucket.refetch();
  };
  return {
    records,
    errors,
    refetch,
    connectedCount: integrations.length + 1,
    isLoading:
      github.loading ||
      gitlabIssues.loading ||
      gitlabMrs.loading ||
      linear.loading ||
      jira.isLoading ||
      sentry.loading ||
      slack.isLoading ||
      bitbucket.loading,
  };
};
