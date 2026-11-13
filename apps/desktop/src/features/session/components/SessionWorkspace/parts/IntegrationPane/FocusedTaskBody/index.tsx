import { PaneShell } from '@goodboy/ui';
import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';
import { openLink } from '../../../../../../open/openLink';
import { ExternalTaskChip } from '../../../../../../integrations/components/ExternalTaskChip';
import { integrationLabel } from '../../../../../../../shared/utils/integrationLabel';
import { RecordHeader } from '../../../../../../../shared/components/StudioDetail/RecordHeader';
import { useSessionRepo } from '../../../../../../../store/slices/worktrees/useSessionRepo';
import { LinearTaskDetail } from '../LinearTaskDetail';
import { GithubTaskDetail } from '../GithubTaskDetail';
import { GitlabTaskDetail } from '../GitlabTaskDetail';
import { JiraTaskDetail } from '../JiraTaskDetail';
import { SlackTaskDetail } from '../SlackTaskDetail';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
  readonly projectId?: ProjectId;
  readonly isConnected: boolean;
};

export const FocusedTaskBody = ({
  provider,
  sessionId,
  workspaceId,
  task,
  projectId,
  isConnected,
}: Props) => {
  const repo = useSessionRepo({ sessionId });

  if (isConnected && provider === 'linear') {
    return <LinearTaskDetail workspaceId={workspaceId} projectId={projectId} task={task} />;
  }

  if (isConnected && provider === 'github') {
    return (
      <GithubTaskDetail workspaceId={workspaceId} rootPath={repo?.repoRoot ?? null} task={task} />
    );
  }

  if (isConnected && provider === 'gitlab') {
    return <GitlabTaskDetail workspaceId={workspaceId} projectId={projectId} task={task} />;
  }

  if (isConnected && provider === 'jira') {
    return <JiraTaskDetail workspaceId={workspaceId} projectId={projectId} task={task} />;
  }

  if (isConnected && provider === 'slack') {
    return <SlackTaskDetail workspaceId={workspaceId} task={task} />;
  }

  return (
    <PaneShell
      scroll="body"
      header={
        <RecordHeader
          provider={provider}
          identifier={task.identifier}
          title={task.title}
          externalRef={{ url: task.url, label: `Open in ${integrationLabel({ provider })}` }}
        />
      }
    >
      <ExternalTaskChip
        task={task}
        appearance="row"
        navigation="external"
        ariaLabel={`Open ${task.identifier}`}
        onClick={() => openLink({ url: task.url })}
      />
      <p className="text-meta text-muted-foreground">
        Connection lost. Open the record in its provider or reconnect in Settings.
      </p>
    </PaneShell>
  );
};
