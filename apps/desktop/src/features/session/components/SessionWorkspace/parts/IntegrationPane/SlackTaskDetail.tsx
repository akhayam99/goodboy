import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { LensEmptyState } from '@goodboy/ui';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
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
      <PaneShell
        scroll="body"
        title={task.title}
        meta={<span className="font-mono">{task.identifier}</span>}
      >
        <LensEmptyState
          icon={CONCEPT_ICONS.slack}
          tone={CONCEPT_TONE.slack}
          title="This link no longer points at a thread"
          description="Unlink it and paste the Slack permalink again."
        />
      </PaneShell>
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
    />
  );
};
