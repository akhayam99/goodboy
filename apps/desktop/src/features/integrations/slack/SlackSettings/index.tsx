import { Eyebrow } from '@goodboy/ui';
import type { SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { IntegrationConnectedRow } from '../../components/IntegrationConnectedRow';
import { disconnectDescriptionOf } from '../../disconnectDescriptionOf';
import { SlackAgentPolicy } from './SlackAgentPolicy';
import { SlackChannels } from './SlackChannels';
import { SlackSignature } from './SlackSignature';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly slack: SlackIntegrationBinding;
  readonly hasHeaderDisconnect?: boolean;
};

export const SlackSettings = ({ workspaceId, slack, hasHeaderDisconnect = false }: Props) => {
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);
  const config = slack.config;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <IntegrationConnectedRow
        provider="slack"
        credentialId={slack.credentialId}
        primary={`Connected as ${config.userName ?? config.userId}`}
        secondary={config.teamName}
        disconnectDescription={disconnectDescriptionOf({ provider: 'slack' })}
        hasHeaderDisconnect={hasHeaderDisconnect}
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'slack' })}
      />

      <section className="flex min-w-0 flex-col gap-2">
        <Eyebrow label="Channels" />
        <SlackChannels workspaceId={workspaceId} slack={slack} />
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <Eyebrow label="What agents can do" />
        <SlackAgentPolicy workspaceId={workspaceId} slack={slack} />
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <Eyebrow label="Signature" />
        <SlackSignature workspaceId={workspaceId} slack={slack} />
      </section>
    </div>
  );
};
