import type { ReactNode } from 'react';
import type { SessionExternalTask, SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import { openUrl } from '../../../../../../shared/lib/editor';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { ExternalTaskChip } from '../../../../../integrations/components/ExternalTaskChip';
import { LinearTaskDetail } from './LinearTaskDetail';
import { SentryTaskDetail } from './SentryTaskDetail';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
  readonly isConnected: boolean;
  readonly headerActions: ReactNode;
};

export const FocusedTaskBody = ({
  provider,
  workspaceId,
  task,
  isConnected,
  headerActions,
}: Props) => {
  if (isConnected && provider === 'linear') {
    return <LinearTaskDetail workspaceId={workspaceId} task={task} headerActions={headerActions} />;
  }

  if (isConnected && provider === 'sentry') {
    return <SentryTaskDetail workspaceId={workspaceId} task={task} headerActions={headerActions} />;
  }

  return (
    <StudioDetailLayout
      fit="fill"
      header={
        <HeaderBand
          meta={
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {task.identifier}
            </span>
          }
          title={task.title}
          actions={headerActions}
        />
      }
    >
      <ExternalTaskChip
        task={task}
        appearance="row"
        navigation="external"
        ariaLabel={`open ${task.identifier}`}
        onClick={() => void openUrl(task.url)}
      />
    </StudioDetailLayout>
  );
};
