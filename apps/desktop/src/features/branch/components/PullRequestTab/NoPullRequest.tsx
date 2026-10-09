import type { Session } from '@goodboy/types';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { PullRequestStart } from '../../../integrations/github/components/PullRequest/PullRequestStart';

type Props = {
  readonly session: Session;
  readonly mountPath: string | null;
  readonly isRepoMissing: boolean;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: () => void;
};

export const NoPullRequest = ({
  session,
  mountPath,
  isRepoMissing,
  isConnected,
  onConnected,
  onCreated,
}: Props) => {
  const follow = useFollowToast();
  return (
    <PullRequestStart
      sessionId={session.id}
      workspaceId={session.workspaceId}
      defaultTitle={session.goal}
      isRepoMissing={isRepoMissing}
      isConnected={isConnected}
      onConnected={onConnected}
      onCreated={() => {
        follow({
          title: 'Pull request created',
          target: { place: branchPlace({ sessionId: session.id, mountPath, tab: 'pr' }) },
        });
        onCreated();
      }}
    />
  );
};
