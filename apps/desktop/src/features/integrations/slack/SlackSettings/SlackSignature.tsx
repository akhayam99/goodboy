import { Input, Switch } from '@goodboy/ui';
import type { SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useSlackConfigSave } from './useSlackConfigSave';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly slack: SlackIntegrationBinding;
};

export const SlackSignature = ({ workspaceId, slack }: Props) => {
  const persist = useSlackConfigSave({ workspaceId });
  const config = slack.config;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Switch
        label="Add a note under messages an agent writes"
        checked={config.signature.agents}
        onChange={(isChecked) =>
          persist({ ...config, signature: { ...config.signature, agents: isChecked } })
        }
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
        label="Also under your messages sent from Goodboy"
        checked={config.signature.own}
        onChange={(isChecked) =>
          persist({ ...config, signature: { ...config.signature, own: isChecked } })
        }
      />
      <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-soft bg-elevated p-3 shadow-sm">
        <span className="text-body text-foreground">I checked the refund split.</span>
        {config.signature.agents && config.signature.text.trim() !== '' ? (
          <span className="text-meta text-faint-foreground">{config.signature.text}</span>
        ) : null}
      </div>
    </div>
  );
};
