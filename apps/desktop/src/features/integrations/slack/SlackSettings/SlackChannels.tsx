import { useEffect } from 'react';
import { Checkbox, SkeletonRow, Switch } from '@goodboy/ui';
import type { SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { SlackSaveError } from './SlackSaveError';
import { useSlackConfigSave } from './useSlackConfigSave';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly slack: SlackIntegrationBinding;
};

export const SlackChannels = ({ workspaceId, slack }: Props) => {
  const channels = useAppStore(
    (state) => state.slackChannels[workspaceId]?.channels ?? EMPTY_ARRAY,
  );
  const refreshSlackChannels = useAppStore((state) => state.refreshSlackChannels);
  const slackSave = useSlackConfigSave({ workspaceId });
  const config = slack.config;

  useEffect(() => {
    void refreshSlackChannels({ workspaceId });
  }, [refreshSlackChannels, workspaceId]);

  const followed = new Set(config.followedChannels.map((channel) => channel.id));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-soft bg-subtle p-3">
        {channels.map((channel) => (
          <Checkbox
            key={channel.id}
            checked={followed.has(channel.id)}
            label={
              <span className="flex min-w-0 items-baseline gap-2">
                <span>#{channel.name}</span>
                {channel.memberCount === null ? null : (
                  <span className="text-meta text-faint-foreground">
                    {channel.memberCount} members
                  </span>
                )}
              </span>
            }
            onChange={(isChecked) =>
              slackSave.save({
                update: ({ config: latest }) => {
                  const others = latest.followedChannels.filter(
                    (candidate) => candidate.id !== channel.id,
                  );
                  return {
                    ...latest,
                    followedChannels: isChecked
                      ? [...others, { id: channel.id, name: channel.name }]
                      : others,
                    hasSelectedChannels: true,
                  };
                },
              })
            }
          />
        ))}
        {channels.length === 0 ? <SkeletonRow label="Loading channels" /> : null}
      </div>
      <Switch
        label="Private channels and direct messages"
        checked={config.includePrivate}
        onChange={(isChecked) =>
          slackSave.save({
            update: ({ config: latest }) => ({ ...latest, includePrivate: isChecked }),
          })
        }
      />
      <SlackSaveError save={slackSave} />
    </div>
  );
};
