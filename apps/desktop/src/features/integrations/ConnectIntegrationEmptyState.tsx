import type { WorkspaceId } from '@goodboy/types';
import { IntegrationConnectPanel } from './components/IntegrationConnectPanel';
import { GitlabFormBody } from './gitlab/GitlabFormBody';
import { LinearFormBody } from './linear/LinearFormBody';
import { SentryFormBody } from './sentry/SentryFormBody';

type Props = {
  readonly provider: 'linear' | 'sentry' | 'gitlab';
  readonly workspaceId: WorkspaceId;
  readonly compact?: boolean;
};

const PROVIDER_DESCRIPTIONS: Record<Props['provider'], string> = {
  linear: 'Connect Linear to review issues from this workspace',
  sentry: 'Connect Sentry to review errors from this workspace',
  gitlab: 'Connect GitLab to review merge requests from this workspace',
};

export const ConnectIntegrationEmptyState = ({ provider, workspaceId, compact = false }: Props) => {
  const className = compact ? 'flex justify-center py-5' : 'flex justify-center';

  if (provider === 'linear') {
    return (
      <div className={className}>
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <LinearFormBody workspaceId={workspaceId} />
        </IntegrationConnectPanel>
      </div>
    );
  }

  if (provider === 'sentry') {
    return (
      <div className={className}>
        <IntegrationConnectPanel
          provider={provider}
          description={PROVIDER_DESCRIPTIONS[provider]}
          size={compact ? 'sm' : 'lg'}
          headingLevel={compact ? undefined : 2}
        >
          <SentryFormBody workspaceId={workspaceId} />
        </IntegrationConnectPanel>
      </div>
    );
  }

  return (
    <div className={className}>
      <IntegrationConnectPanel
        provider={provider}
        description={PROVIDER_DESCRIPTIONS[provider]}
        size={compact ? 'sm' : 'lg'}
        headingLevel={compact ? undefined : 2}
      >
        <GitlabFormBody workspaceId={workspaceId} />
      </IntegrationConnectPanel>
    </div>
  );
};
