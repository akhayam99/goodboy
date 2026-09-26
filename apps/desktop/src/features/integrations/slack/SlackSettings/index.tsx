import { useEffect } from 'react';
import { Checkbox, Eyebrow, Input, Switch } from '@goodboy/ui';
import type { SlackIntegrationBinding, SlackIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { IntegrationConnectedRow } from '../../components/IntegrationConnectedRow';
import { SlackPolicyRow } from './SlackPolicyRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly slack: SlackIntegrationBinding;
};

const BINARY_OPTIONS = [
  { value: 'allow', label: 'Allowed' },
  { value: 'off', label: 'Off' },
] as const;

const ACTION_OPTIONS = [
  { value: 'allow', label: 'Allowed' },
  { value: 'ask', label: 'Ask me first' },
  { value: 'never', label: 'Never' },
] as const;

type SaveParams = {
  readonly config: SlackIntegrationConfig;
  readonly workspaceId: WorkspaceId;
  readonly update: (params: {
    readonly workspaceId: WorkspaceId;
    readonly config: SlackIntegrationConfig;
  }) => Promise<void>;
};

const save = ({ config, workspaceId, update }: SaveParams): void => {
  void update({ workspaceId, config });
};

export const SlackSettings = ({ workspaceId, slack }: Props) => {
  const channels = useAppStore(
    (state) => state.slackChannels[workspaceId]?.channels ?? EMPTY_ARRAY,
  );
  const refreshSlackChannels = useAppStore((state) => state.refreshSlackChannels);
  const updateSlackConfig = useAppStore((state) => state.updateSlackConfig);
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);
  const config = slack.config;

  useEffect(() => {
    void refreshSlackChannels({ workspaceId });
  }, [refreshSlackChannels, workspaceId]);

  const persist = (next: SlackIntegrationConfig): void =>
    save({ config: next, workspaceId, update: updateSlackConfig });
  const followed = new Set(config.followedChannels.map((channel) => channel.id));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <IntegrationConnectedRow
        provider="slack"
        credentialId={slack.credentialId}
        primary={`Connected as ${config.userName ?? config.userId}`}
        secondary={config.teamName}
        disconnectDescription="Unlinks this workspace from Slack. The saved credential remains available to other workspaces."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'slack' })}
      />

      <section className="flex min-w-0 flex-col gap-2">
        <Eyebrow label="Channels" />
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-soft bg-subtle p-3">
          {channels.map((channel) => (
            <Checkbox
              key={channel.id}
              checked={followed.has(channel.id)}
              label={
                <span className="flex min-w-0 items-baseline gap-2">
                  <span>#{channel.name}</span>
                  {channel.memberCount === null ? null : (
                    <span className="text-secondary text-faint-foreground">
                      {channel.memberCount} members
                    </span>
                  )}
                </span>
              }
              onChange={(isChecked) => {
                const next = isChecked
                  ? [...config.followedChannels, { id: channel.id, name: channel.name }]
                  : config.followedChannels.filter((candidate) => candidate.id !== channel.id);
                persist({ ...config, followedChannels: next, hasSelectedChannels: true });
              }}
            />
          ))}
          {channels.length === 0 ? (
            <span className="text-secondary text-muted-foreground">Loading your channels…</span>
          ) : null}
        </div>
        <Switch
          label="Private channels and direct messages"
          checked={config.includePrivate}
          onChange={(includePrivate) => persist({ ...config, includePrivate })}
        />
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <Eyebrow label="What agents can do" />
        <SlackPolicyRow
          label="Read threads in followed channels"
          value={config.agentPolicy.readFollowed}
          options={BINARY_OPTIONS}
          onChange={(readFollowed) =>
            persist({ ...config, agentPolicy: { ...config.agentPolicy, readFollowed } })
          }
        />
        <SlackPolicyRow
          label="Read other channels you're in"
          value={config.agentPolicy.readOthers}
          options={BINARY_OPTIONS}
          onChange={(readOthers) =>
            persist({ ...config, agentPolicy: { ...config.agentPolicy, readOthers } })
          }
        />
        <SlackPolicyRow
          label="Reply in threads"
          value={config.agentPolicy.reply}
          options={ACTION_OPTIONS}
          onChange={(reply) =>
            persist({ ...config, agentPolicy: { ...config.agentPolicy, reply } })
          }
        />
        <SlackPolicyRow
          label="Add reactions"
          value={config.agentPolicy.react}
          options={ACTION_OPTIONS}
          onChange={(react) =>
            persist({ ...config, agentPolicy: { ...config.agentPolicy, react } })
          }
        />
        <span className="text-secondary text-faint-foreground">
          Agents never start new conversations or send direct messages.
        </span>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <Eyebrow label="Signature" />
        <Switch
          label="Add a note under messages an agent writes"
          checked={config.signature.agents}
          onChange={(agents) => persist({ ...config, signature: { ...config.signature, agents } })}
        />
        <Input
          aria-label="Agent message signature"
          value={config.signature.text}
          disabled={!config.signature.agents}
          onChange={(event) =>
            persist({
              ...config,
              signature: { ...config.signature, text: event.target.value },
            })
          }
        />
        <Switch
          label="Also under messages I send from Goodboy"
          checked={config.signature.own}
          onChange={(own) => persist({ ...config, signature: { ...config.signature, own } })}
        />
        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-soft bg-elevated p-3 shadow-sm">
          <span className="text-body text-foreground">I checked the refund split.</span>
          {config.signature.agents && config.signature.text.trim() !== '' ? (
            <span className="text-secondary text-faint-foreground">{config.signature.text}</span>
          ) : null}
        </div>
      </section>
    </div>
  );
};
