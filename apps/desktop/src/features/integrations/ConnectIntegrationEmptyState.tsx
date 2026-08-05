import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { IntegrationConnectPanel } from './components/IntegrationConnectPanel';
import { BitbucketFormBody } from './bitbucket/BitbucketFormBody';
import { GitlabFormBody } from './gitlab/GitlabFormBody';
import { JiraFormBody } from './jira/JiraFormBody';
import { LinearFormBody } from './linear/LinearFormBody';
import { SentryFormBody } from './sentry/SentryFormBody';
import { SlackFormBody } from './slack/SlackFormBody';

type Props = {
  readonly provider: 'linear' | 'sentry' | 'gitlab' | 'jira' | 'bitbucket' | 'slack';
  readonly workspaceId: WorkspaceId;
  readonly compact?: boolean;
  readonly shouldAutoFocus?: boolean;
  readonly wrapped?: boolean;
};

const PROVIDER_DESCRIPTIONS: Record<Props['provider'], string> = {
  linear: 'Connect Linear to review issues from this workspace',
  sentry: 'Connect Sentry to review errors from this workspace',
  gitlab: 'Connect GitLab to review merge requests from this workspace',
  jira: 'Connect Jira to review issues from this workspace',
  bitbucket: 'Connect Bitbucket to review pull requests from this workspace',
  slack: 'Connect Slack to read the threads a task came out of',
};

const renderWrapped = ({
  panel,
  compact,
  wrapped,
}: {
  readonly panel: ReactNode;
  readonly compact: boolean;
  readonly wrapped: boolean;
}) => {
  if (!wrapped) {
    return panel;
  }

  return (
    <div className={compact ? 'flex justify-center py-5' : 'flex justify-center'}>{panel}</div>
  );
};

export const ConnectIntegrationEmptyState = ({
  provider,
  workspaceId,
  compact = false,
  shouldAutoFocus = false,
  wrapped = true,
}: Props) => {
  if (provider === 'linear') {
    return renderWrapped({
      compact,
      wrapped,
      panel: (
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <LinearFormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
        </IntegrationConnectPanel>
      ),
    });
  }

  if (provider === 'sentry') {
    return renderWrapped({
      compact,
      wrapped,
      panel: (
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <SentryFormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
        </IntegrationConnectPanel>
      ),
    });
  }

  if (provider === 'bitbucket') {
    return renderWrapped({
      compact,
      wrapped,
      panel: (
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <BitbucketFormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
        </IntegrationConnectPanel>
      ),
    });
  }

  if (provider === 'slack') {
    return renderWrapped({
      compact,
      wrapped,
      panel: (
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <SlackFormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
        </IntegrationConnectPanel>
      ),
    });
  }

  if (provider === 'jira') {
    return renderWrapped({
      compact,
      wrapped,
      panel: (
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <JiraFormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
        </IntegrationConnectPanel>
      ),
    });
  }

  return renderWrapped({
    compact,
    wrapped,
    panel: (
      <IntegrationConnectPanel
        provider={provider}
        description={PROVIDER_DESCRIPTIONS[provider]}
        size={compact ? 'sm' : 'lg'}
        headingLevel={compact ? undefined : 2}
      >
        <GitlabFormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
      </IntegrationConnectPanel>
    ),
  });
};
