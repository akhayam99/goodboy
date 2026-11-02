import type { SessionExternalTaskProvider } from '@goodboy/types';

type ProviderMeta = Readonly<{
  label: string;
  nounPlural: string;
  linkHint: string;
}>;

export const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: {
    label: 'Linear',
    nounPlural: 'issues',
    linkHint: 'Search your assigned Linear issues or paste a URL to link one to this session.',
  },
  sentry: {
    label: 'Sentry',
    nounPlural: 'issues',
    linkHint: 'Search your assigned Sentry issues or paste a URL to link one to this session.',
  },
  gitlab: {
    label: 'GitLab',
    nounPlural: 'issues',
    linkHint: 'Search your assigned GitLab issues or paste a URL to link one to this session.',
  },
  jira: {
    label: 'Jira',
    nounPlural: 'issues',
    linkHint: 'Search your assigned Jira issues or paste a URL to link one to this session.',
  },
  github: {
    label: 'GitHub',
    nounPlural: 'issues',
    linkHint: 'Search your assigned GitHub issues or paste a URL to link one to this session.',
  },
  bitbucket: {
    label: 'Bitbucket',
    nounPlural: 'pull requests',
    linkHint: 'Paste a Bitbucket pull request URL to link one to this session.',
  },
  slack: {
    label: 'Slack',
    nounPlural: 'threads',
    linkHint: 'Pick a thread from a channel you are in, or paste a Slack permalink to link one.',
  },
};
