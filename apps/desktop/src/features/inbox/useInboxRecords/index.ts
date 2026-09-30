import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useGithubIssues } from '../../integrations/github/components/PullRequest/useGithubIssues';
import { useGithubPrs } from '../../integrations/github/components/PullRequest/useGithubPrs';
import { useBitbucketPrs } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import { useWorkspaceBitbucketRepo } from '../../integrations/bitbucket/useWorkspaceBitbucketRepo';
import { useGitlabIssues } from '../../integrations/gitlab/MergeRequest/useGitlabIssues';
import { useGitlabMrs } from '../../integrations/gitlab/MergeRequest/useGitlabMrs';
import { useJiraIssues } from '../../integrations/jira/JiraStudio/useJiraIssues';
import { useLinearIssues } from '../../integrations/linear/LinearStudio/useLinearIssues';
import { useSlackThreads } from '../../integrations/slack/SlackStudio/useSlackThreads';
import { adaptBitbucketPrs } from '../adapters/bitbucket';
import { adaptGithubIssues, adaptGithubPrs } from '../adapters/github';
import { adaptGitlab } from '../adapters/gitlab';
import { adaptJiraIssues } from '../adapters/jira';
import { adaptLinearIssues } from '../adapters/linear';
import { adaptSentryIssues } from '../adapters/sentry';
import { adaptSlackThreads } from '../adapters/slack';
import { attachInboxProjects } from '../attachInboxProjects';
import { orderInboxRecords } from '../orderInboxRecords';
import { INBOX_PROVIDERS, type InboxProvider, type InboxRecord } from '../types';
import { useInboxSentryIssues } from '../useInboxSentryIssues';

type Params = { readonly workspaceId: WorkspaceId; readonly rootPath: string };
type Errors = Readonly<Record<InboxProvider, string | null>>;
type Loading = Readonly<Record<InboxProvider, boolean>>;
type Result = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly isLoading: boolean;
  readonly loading: Loading;
  readonly errors: Errors;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly projects: ReadonlyArray<Project>;
  readonly refetch: () => void;
};

export const useInboxRecords = ({ workspaceId, rootPath }: Params): Result => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const has = (provider: InboxProvider): boolean =>
    provider === 'github' ? true : integrations.some((binding) => binding.provider === provider);
  const github = useGithubIssues({ workspaceId, rootPath, isEnabled: has('github') });
  const githubPrs = useGithubPrs({ workspaceId, rootPath, isEnabled: has('github') });
  const gitlabIssues = useGitlabIssues({ workspaceId, isEnabled: has('gitlab') });
  const gitlabMrs = useGitlabMrs({ workspaceId, isEnabled: has('gitlab') });
  const linear = useLinearIssues(workspaceId, has('linear'));
  const jira = useJiraIssues({ workspaceId, isEnabled: has('jira'), assignedOnly: true });
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt == null,
      ),
    ),
  );
  const { sentry, links: sentryLinks } = useInboxSentryIssues({
    workspaceId,
    isEnabled: has('sentry'),
  });
  const slack = useSlackThreads({ workspaceId, isEnabled: has('slack') });
  const bitbucketRepo = useWorkspaceBitbucketRepo({ workspaceId, isEnabled: has('bitbucket') });
  const bitbucket = useBitbucketPrs({ repo: bitbucketRepo });
  const adapted = useMemo(
    () =>
      orderInboxRecords({
        records: [
          ...adaptGithubIssues({ groups: github.groups }),
          ...adaptGithubPrs({ groups: githubPrs.groups }),
          ...adaptGitlab({
            issueGroups: gitlabIssues.groups,
            mrGroups: gitlabMrs.groups,
            host: gitlabMrs.host,
          }),
          ...adaptLinearIssues({ groups: linear.groups }),
          ...adaptJiraIssues({ groups: jira.groups }),
          ...adaptSentryIssues({ rows: sentry.rows }),
          ...adaptSlackThreads({ groups: slack.groups, now: new Date() }),
          ...adaptBitbucketPrs({ groups: bitbucket.groups, repo: bitbucketRepo }),
        ],
      }),
    [
      github.groups,
      githubPrs.groups,
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
  const records = useMemo(
    () =>
      attachInboxProjects({
        records: adapted,
        projects,
        links: sentryLinks,
        gitlabHosts: gitlabMrs.host == null ? [] : [gitlabMrs.host],
      }),
    [adapted, projects, sentryLinks, gitlabMrs.host],
  );
  const errors = {
    github: github.error ?? githubPrs.error,
    gitlab: gitlabIssues.error ?? gitlabMrs.error,
    linear: linear.error,
    jira: jira.error,
    sentry: sentry.error,
    slack: slack.error,
    bitbucket: bitbucket.error,
  } satisfies Errors;
  const loading = {
    github: github.loading || githubPrs.loading,
    gitlab: gitlabIssues.loading || gitlabMrs.loading,
    linear: linear.loading,
    jira: jira.isLoading,
    sentry: sentry.loading,
    slack: slack.isLoading,
    bitbucket: bitbucket.loading,
  } satisfies Loading;
  const connected = INBOX_PROVIDERS.filter((provider) =>
    provider === 'github' ? github.hasRemote === true : has(provider),
  );
  const refetch = (): void => {
    github.refetch();
    githubPrs.refetch();
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
    connected,
    projects,
    refetch,
    loading,
    isLoading: INBOX_PROVIDERS.some((provider) => loading[provider]),
  };
};
