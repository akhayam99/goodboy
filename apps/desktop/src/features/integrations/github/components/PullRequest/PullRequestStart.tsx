import { EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { GithubConnectionEmptyState } from '../GithubConnectionEmptyState';
import { CreatePrPanel } from './CreatePrPanel';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly defaultTitle: string;
  readonly isRepoMissing: boolean;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: () => void;
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
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <EmptyState
        size="page"
        icon={CONCEPT_ICONS.pr}
        title="No pull request yet"
        description="Comments live on the pull request. Create it here."
      />
      <CreatePrPanel sessionId={sessionId} defaultTitle={defaultTitle} onCreated={onCreated} />
    </div>
  );
};
