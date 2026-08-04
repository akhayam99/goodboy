import type { WorkspaceId } from '@goodboy/types';
import { MissingGithubRemoteEmptyState } from './MissingGithubRemoteEmptyState';
import { MissingGithubTokenEmptyState } from './MissingGithubTokenEmptyState';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly hasGithubRemote: boolean;
  readonly compact?: boolean;
  readonly onConnected: () => void;
  readonly shouldAutoFocus?: boolean;
  readonly wrapped?: boolean;
};

export const GithubConnectionEmptyState = ({
  workspaceId,
  hasGithubRemote,
  compact = false,
  onConnected,
  shouldAutoFocus = false,
  wrapped = true,
}: Props) => {
  if (hasGithubRemote === false) {
    return <MissingGithubRemoteEmptyState compact={compact} wrapped={wrapped} />;
  }

  return (
    <MissingGithubTokenEmptyState
      workspaceId={workspaceId}
      compact={compact}
      onConnected={onConnected}
      shouldAutoFocus={shouldAutoFocus}
      wrapped={wrapped}
    />
  );
};
