import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { HeaderBand } from '@goodboy/ui';
import { LensEmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { SlackThreadDetail } from '../../../../../integrations/slack/SlackThreadDetail';
import { parseSlackThreadExternalId } from '../../../../../integrations/slack/threadFormulas';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
};

export const SlackTaskDetail = ({ workspaceId, task }: Props) => {
  const parsed = parseSlackThreadExternalId({ externalId: task.externalId });

  if (parsed == null) {
    return (
      <StudioDetailLayout
        fit="fill"
        header={
          <HeaderBand
            title={task.title}
            meta={
              <span className="font-mono text-2xs text-muted-foreground">{task.identifier}</span>
            }
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

  return (
    <SlackThreadDetail
      workspaceId={workspaceId}
      channelId={parsed.channelId}
      threadTs={parsed.threadTs}
      fallbackChannelName={task.identifier.replace(/^#/, '')}
      fallbackMessage={null}
      fallbackUrl={task.url}
      fit="fill"
    />
  );
};
