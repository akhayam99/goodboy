import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { openUrl } from '../../../../../../shared/lib/editor';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { ExternalTaskChip } from '../../../../../integrations/components/ExternalTaskChip';
import { useSessionRepo } from '../../../../../../store/slices/worktrees/useSessionRepo';
import { LinearTaskDetail } from './LinearTaskDetail';
import { SentryTaskDetail } from './SentryTaskDetail';
import { GithubTaskDetail } from './GithubTaskDetail';
import { GitlabTaskDetail } from './GitlabTaskDetail';
import { JiraTaskDetail } from './JiraTaskDetail';
import { SlackTaskDetail } from './SlackTaskDetail';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
  readonly isConnected: boolean;
};

export const FocusedTaskBody = ({ provider, sessionId, workspaceId, task, isConnected }: Props) => {
  const repo = useSessionRepo({ sessionId });

  if (isConnected && provider === 'linear') {
    return <LinearTaskDetail workspaceId={workspaceId} task={task} />;
  }

  if (isConnected && provider === 'sentry') {
    return <SentryTaskDetail workspaceId={workspaceId} task={task} />;
  }

  if (isConnected && provider === 'github') {
    return (
      <GithubTaskDetail workspaceId={workspaceId} rootPath={repo?.repoRoot ?? null} task={task} />
    );
  }

  if (isConnected && provider === 'gitlab') {
    return <GitlabTaskDetail workspaceId={workspaceId} task={task} />;
  }

  if (isConnected && provider === 'jira') {
    return <JiraTaskDetail workspaceId={workspaceId} task={task} />;
  }

  if (isConnected && provider === 'slack') {
    return <SlackTaskDetail workspaceId={workspaceId} task={task} />;
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
        />
      }
    >
      <ExternalTaskChip
        task={task}
        appearance="row"
        navigation="external"
        ariaLabel={`Open ${task.identifier}`}
        onClick={() => void openUrl(task.url)}
      />
    </StudioDetailLayout>
  );
};
