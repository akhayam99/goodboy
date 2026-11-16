import type { SlackIntegrationBinding, SlackIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { SlackPolicyRow } from './SlackPolicyRow';
import { SlackSaveError } from './SlackSaveError';
import { useSlackConfigSave } from './useSlackConfigSave';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly slack: SlackIntegrationBinding;
};

type PolicyParams = {
  readonly policy: Partial<SlackIntegrationConfig['agentPolicy']>;
};

const BINARY_OPTIONS = [
  { value: 'allow', label: 'Allowed' },
  { value: 'off', label: 'Off' },
] as const;

const ACTION_OPTIONS = [
  { value: 'allow', label: 'Allowed' },
  { value: 'ask', label: 'Ask first' },
  { value: 'never', label: 'Never' },
] as const;

export const SlackAgentPolicy = ({ workspaceId, slack }: Props) => {
  const slackSave = useSlackConfigSave({ workspaceId });
  const config = slack.config;
  const savePolicy = ({ policy }: PolicyParams) =>
    slackSave.save({
      update: ({ config: latest }) => ({
        ...latest,
        agentPolicy: { ...latest.agentPolicy, ...policy },
      }),
    });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SlackPolicyRow
        label="Read threads in followed channels"
        value={config.agentPolicy.readFollowed}
        options={BINARY_OPTIONS}
        onChange={(readFollowed) => savePolicy({ policy: { readFollowed } })}
      />
      <SlackPolicyRow
        label="Read other channels you're in"
        value={config.agentPolicy.readOthers}
        options={BINARY_OPTIONS}
        onChange={(readOthers) => savePolicy({ policy: { readOthers } })}
      />
      <SlackPolicyRow
        label="Reply in threads"
        value={config.agentPolicy.reply}
        options={ACTION_OPTIONS}
        onChange={(reply) => savePolicy({ policy: { reply } })}
      />
      <SlackPolicyRow
        label="Add reactions"
        value={config.agentPolicy.react}
        options={ACTION_OPTIONS}
        onChange={(react) => savePolicy({ policy: { react } })}
      />
      <SlackSaveError save={slackSave} />
      <span className="text-meta text-faint-foreground">
        Agents never start new conversations or send direct messages.
      </span>
    </div>
  );
};
