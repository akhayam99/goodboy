import type { ComponentType } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { IntegrationConnectPanel } from './components/IntegrationConnectPanel';
import { BitbucketFormBody } from './bitbucket/BitbucketFormBody';
import { GitlabFormBody } from './gitlab/GitlabFormBody';
import { JiraFormBody } from './jira/JiraFormBody';
import { LinearFormBody } from './linear/LinearFormBody';
import { SentryFormBody } from './sentry/SentryFormBody';
import { SlackFormBody } from './slack/SlackFormBody';

type Provider = 'linear' | 'sentry' | 'gitlab' | 'jira' | 'bitbucket' | 'slack';

type Props = {
  readonly provider: Provider;
  readonly workspaceId: WorkspaceId;
  readonly compact?: boolean;
  readonly shouldAutoFocus?: boolean;
  readonly wrapped?: boolean;
};

type FormBodyProps = {
  readonly workspaceId: WorkspaceId;
  readonly shouldAutoFocus?: boolean;
};

const PROVIDER_DESCRIPTIONS: Record<Provider, string> = {
  linear: 'Connect Linear to review issues from this project',
  sentry: 'Connect Sentry to review errors from this project',
  gitlab: 'Connect GitLab to review merge requests from this project',
  jira: 'Connect Jira to review issues from this project',
  bitbucket: 'Connect Bitbucket to review pull requests from this project',
  slack: 'Connect Slack to read the threads a task came out of',
};

const FORM_BODIES: Record<Provider, ComponentType<FormBodyProps>> = {
  linear: LinearFormBody,
  sentry: SentryFormBody,
  gitlab: GitlabFormBody,
  jira: JiraFormBody,
  bitbucket: BitbucketFormBody,
  slack: SlackFormBody,
};

export const ConnectIntegrationEmptyState = ({
  provider,
  workspaceId,
  compact = false,
  shouldAutoFocus = false,
  wrapped = true,
}: Props) => {
  const FormBody = FORM_BODIES[provider];
  const panel = (
    <IntegrationConnectPanel
      provider={provider}
      description={PROVIDER_DESCRIPTIONS[provider]}
      headingLevel={compact ? undefined : 2}
    >
      <FormBody workspaceId={workspaceId} shouldAutoFocus={shouldAutoFocus} />
    </IntegrationConnectPanel>
  );

  if (!wrapped) {
    return panel;
  }

  return (
    <div className={compact ? 'flex justify-center py-5' : 'flex justify-center'}>{panel}</div>
  );
};
