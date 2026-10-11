import type { SessionId, WorkspaceId } from '@goodboy/types';
import { GithubConnectionEmptyState } from '../GithubConnectionEmptyState';
import { CreatePrPanel } from './CreatePrPanel';

type CreatedPullRequest = {
  readonly number: number | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly defaultTitle: string;
  readonly isRepoMissing: boolean;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: (created: CreatedPullRequest) => void;
};

export const PullRequestStart = ({
  sessionId,
  workspaceId,
  defaultTitle,
  isRepoMissing,
  isConnected,
  onConnected,
  onCreated,
}: Props) => {
  if (isRepoMissing) {
    return (
      <GithubConnectionEmptyState
        workspaceId={workspaceId}
        isConnected={isConnected}
        onConnected={onConnected}
      />
    );
  }
  return <CreatePrPanel sessionId={sessionId} defaultTitle={defaultTitle} onCreated={onCreated} />;
};
