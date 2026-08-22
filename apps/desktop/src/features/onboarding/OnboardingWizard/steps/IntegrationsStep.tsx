import { useState } from 'react';
import { Plug } from 'lucide-react';
import {
  BitbucketIcon,
  GithubIcon,
  GitlabIcon,
  JiraIcon,
  LinearIcon,
  SentryIcon,
  SlackIcon,
} from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { JiraFormBody } from '../../../integrations/jira/JiraFormBody';
import { LinearFormBody } from '../../../integrations/linear/LinearFormBody';
import { SentryFormBody } from '../../../integrations/sentry/SentryFormBody';
import { SlackFormBody } from '../../../integrations/slack/SlackFormBody';
import { Segmented, type SegmentedOption } from '../Segmented';
import { CodeHostForm, type CodeHost } from './CodeHostForm';

type IntegrationTab = CodeHost | 'linear' | 'jira' | 'slack' | 'sentry';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly githubConnected: boolean;
  readonly gitlabConnected: boolean;
  readonly bitbucketConnected: boolean;
  readonly linearConnected: boolean;
  readonly jiraConnected: boolean;
  readonly slackConnected: boolean;
  readonly sentryConnected: boolean;
  readonly onConnected: () => void;
};

export const IntegrationsStep = ({
  workspaceId,
  githubConnected,
  gitlabConnected,
  bitbucketConnected,
  linearConnected,
  jiraConnected,
  slackConnected,
  sentryConnected,
  onConnected,
}: Props) => {
  const [tab, setTab] = useState<IntegrationTab>('github');

  const options: ReadonlyArray<SegmentedOption<IntegrationTab>> = [
    {
      value: 'github',
      label: 'GitHub',
      icon: GithubIcon,
      color: 'var(--color-provider-github)',
      connected: githubConnected,
    },
    {
      value: 'gitlab',
      label: 'GitLab',
      icon: GitlabIcon,
      color: 'var(--color-provider-gitlab)',
      connected: gitlabConnected,
    },
    {
      value: 'bitbucket',
      label: 'Bitbucket',
      icon: BitbucketIcon,
      color: 'var(--color-provider-bitbucket)',
      connected: bitbucketConnected,
    },
    {
      value: 'linear',
      label: 'Linear',
      icon: LinearIcon,
      color: 'var(--color-provider-linear)',
      connected: linearConnected,
    },
    {
      value: 'jira',
      label: 'Jira',
      icon: JiraIcon,
      color: 'var(--color-provider-jira)',
      connected: jiraConnected,
    },
    {
      value: 'slack',
      label: 'Slack',
      icon: SlackIcon,
      color: 'var(--color-provider-slack)',
      connected: slackConnected,
    },
    {
      value: 'sentry',
      label: 'Sentry',
      icon: SentryIcon,
      color: 'var(--color-provider-sentry)',
      connected: sentryConnected,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-foreground">
        <Plug size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect your services
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Link a code host for pull requests, a tracker for issue context, Slack for conversations,
          and Sentry for production errors. Connect what you use; everything here is optional and
          available later.
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 text-left">
        <Segmented ariaLabel="Integrations" options={options} value={tab} onChange={setTab} />
        <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
          {tab === 'github' || tab === 'gitlab' || tab === 'bitbucket' ? (
            <CodeHostForm host={tab} workspaceId={workspaceId} onConnected={onConnected} />
          ) : tab === 'linear' ? (
            <LinearFormBody workspaceId={workspaceId} />
          ) : tab === 'jira' ? (
            <JiraFormBody workspaceId={workspaceId} />
          ) : tab === 'slack' ? (
            <SlackFormBody workspaceId={workspaceId} />
          ) : (
            <SentryFormBody workspaceId={workspaceId} />
          )}
        </div>
      </div>
    </div>
  );
};
