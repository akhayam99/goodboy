import type { SessionExternalTask, SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import { openUrl } from '../../../../../../shared/lib/editor';
import { ExternalTaskChip } from '../../../../../integrations/components/ExternalTaskChip';
import { LinearTaskDetail } from './LinearTaskDetail';
import { SentryTaskDetail } from './SentryTaskDetail';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
  readonly isConnected: boolean;
};

export const FocusedTaskBody = ({ provider, workspaceId, task, isConnected }: Props) => {
  if (isConnected && provider === 'linear') {
    return <LinearTaskDetail workspaceId={workspaceId} issueId={task.externalId} />;
  }

  if (isConnected && provider === 'sentry') {
    return <SentryTaskDetail workspaceId={workspaceId} task={task} />;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-5">
      <ExternalTaskChip
        task={task}
        appearance="row"
        navigation="external"
        ariaLabel={`open ${task.identifier}`}
        onClick={() => void openUrl(task.url)}
      />
    </div>
  );
};
