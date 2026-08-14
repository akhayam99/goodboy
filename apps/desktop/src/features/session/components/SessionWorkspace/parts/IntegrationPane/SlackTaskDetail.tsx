import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { HeaderBand } from '@goodboy/ui';
import { LensEmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { SlackThreadDetail } from '../../../../../integrations/slack/SlackThreadDetail';
import { parseSlackThreadExternalId } from '../../../../../integrations/slack/threadFormulas';
import { useSlackThread } from '../../../../../integrations/slack/useSlackThread';
import { useSlackThreadActions } from '../../../../../integrations/slack/useSlackThreadActions';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
};

export const SlackTaskDetail = ({ workspaceId, task }: Props) => {
  const parsed = parseSlackThreadExternalId({ externalId: task.externalId });
  const thread = useSlackThread({
    workspaceId,
    channelId: parsed?.channelId ?? '',
    threadTs: parsed?.threadTs ?? '',
    isEnabled: parsed != null,
  });
  const actions = useSlackThreadActions({
    workspaceId,
    channelId: parsed?.channelId ?? '',
    threadTs: parsed?.threadTs ?? '',
    isEnabled: parsed != null,
  });

  if (parsed == null) {
    return (
      <StudioDetailLayout
        fit="fill"
        header={
          <HeaderBand
            meta={
              <span className="font-mono text-2xs text-muted-foreground">{task.identifier}</span>
            }
            title={task.title}
          />
        }
      >
        <LensEmptyState
          icon={CONCEPT_ICONS.slack}
          tone={CONCEPT_TONE.slack}
          title="This link no longer points at a thread"
          description="Unlink it and paste the Slack permalink again."
        />
      </StudioDetailLayout>
    );
  }

  const rootText = thread.messages[0]?.text ?? task.title;

  return (
    <SlackThreadDetail
      channelName={thread.channelName}
      rootText={rootText}
      url={task.url}
      messages={thread.messages}
      users={thread.users}
      channels={thread.channels}
      isLoading={thread.isLoading}
      error={thread.error}
      onRetry={thread.refetch}
      actions={actions}
      fit="fill"
    />
  );
};
