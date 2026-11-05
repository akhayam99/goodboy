import type { MountId, SessionId, WorkspaceId } from '@goodboy/types';
import { GithubConnectionEmptyState } from '../GithubConnectionEmptyState';
import { CreatePrPanel } from './CreatePrPanel';

type CreatedPullRequest = {
  readonly number: number | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly mountId: MountId | null;
  readonly defaultTitle: string;
  readonly defaultBody: string;
  readonly submitVariant?: 'primary' | 'secondary';
  readonly defaultBase?: string;
  readonly isRepoMissing: boolean;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: (created: CreatedPullRequest) => void;
};

export const PullRequestStart = ({
  sessionId,
  workspaceId,
  mountId,
  defaultTitle,
  defaultBody,
  submitVariant = 'primary',
  defaultBase = '',
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
    <CreatePrPanel
      sessionId={sessionId}
      mountId={mountId}
      defaultTitle={defaultTitle}
      defaultBody={defaultBody}
      submitVariant={submitVariant}
      defaultBase={defaultBase}
      onCreated={onCreated}
    />
  );
};
