import type { SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { SlackPolicyRow } from './SlackPolicyRow';
import { useSlackConfigSave } from './useSlackConfigSave';

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
  { value: 'ask', label: 'Ask first' },
  { value: 'never', label: 'Never' },
] as const;

export const SlackAgentPolicy = ({ workspaceId, slack }: Props) => {
  const persist = useSlackConfigSave({ workspaceId });
  const config = slack.config;

  return (
    <div className="flex min-w-0 flex-col gap-3">
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
        onChange={(reply) => persist({ ...config, agentPolicy: { ...config.agentPolicy, reply } })}
      />
      <SlackPolicyRow
        label="Add reactions"
        value={config.agentPolicy.react}
        options={ACTION_OPTIONS}
        onChange={(react) => persist({ ...config, agentPolicy: { ...config.agentPolicy, react } })}
      />
      <span className="text-meta text-faint-foreground">
        Agents never start new conversations or send direct messages.
      </span>
    </div>
  );
};
