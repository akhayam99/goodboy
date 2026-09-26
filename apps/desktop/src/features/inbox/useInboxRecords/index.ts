import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useGithubIssues } from '../../github/components/PullRequest/useGithubIssues';
import { useBitbucketPrs } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import { useWorkspaceBitbucketRepo } from '../../integrations/bitbucket/useWorkspaceBitbucketRepo';
import { useGitlabIssues } from '../../integrations/gitlab/MergeRequest/useGitlabIssues';
import { useGitlabMrs } from '../../integrations/gitlab/MergeRequest/useGitlabMrs';
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
import { attachInboxProjects } from '../attachInboxProjects';
import { INBOX_PROVIDERS, type InboxProvider, type InboxRecord } from '../types';

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
  const sentryLinks = useAppStore((state) => state.projectSentryLinks[workspaceId] ?? EMPTY_ARRAY);
  const loadProjectSentryLinks = useAppStore((state) => state.loadProjectSentryLinks);
  const hasSentry = has('sentry');
  useEffect(() => {
    if (!hasSentry) {
      return;
    }
    void loadProjectSentryLinks({ workspaceId }).catch(() => undefined);
  }, [hasSentry, loadProjectSentryLinks, workspaceId]);
  const linkedSentryProjects = useMemo(
    () => sentryLinks.map((link) => link.sentryProject),
    [sentryLinks],
  );
  const sentry = useSentryIssues(workspaceId, hasSentry, linkedSentryProjects);
  const slack = useSlackThreads({ workspaceId, isEnabled: has('slack') });
  const bitbucketRepo = useWorkspaceBitbucketRepo({ workspaceId, isEnabled: has('bitbucket') });
  const bitbucket = useBitbucketPrs({ repo: bitbucketRepo });
  const adapted = useMemo(
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
        ...adaptSlackThreads({ groups: slack.groups, now: new Date() }),
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
  const records = useMemo(
    () => attachInboxProjects({ records: adapted, projects, rootPath, links: sentryLinks }),
    [adapted, projects, rootPath, sentryLinks],
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
  const loading = {
    github: github.loading,
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
