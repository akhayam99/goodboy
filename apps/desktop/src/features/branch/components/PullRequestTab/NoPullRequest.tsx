import type { Session } from '@goodboy/types';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { PullRequestStart } from '../../../integrations/github/components/PullRequest/PullRequestStart';
import { CreateMrForm } from '../../../integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';

type Props = {
  readonly session: Session;
  readonly mountPath: string | null;
  readonly isRepoMissing: boolean;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: () => void;
};

type OpenedParams = {
  readonly number: number | null;
};

const openedWord = ({ number }: OpenedParams): string =>
  number === null ? 'Pull request opened' : `Pull request #${number} opened`;

export const NoPullRequest = ({
  session,
  mountPath,
  isRepoMissing,
  isConnected,
  onConnected,
  onCreated,
}: Props) => {
  const follow = useFollowToast();
  const repoRoot = useAppStore((state) =>
    mountPath === null
      ? null
      : (selectMountForPath({ state, sessionId: session.id, path: mountPath })?.repoRoot ?? null),
  );
  const hostKind = useMountRemoteHostKind({ sessionId: session.id, repoRoot });
  if (hostKind === 'gitlab' && !isRepoMissing) {
    return <CreateMrForm sessionId={session.id} onCreated={onCreated} />;
  }
  return (
    <PullRequestStart
      sessionId={session.id}
      workspaceId={session.workspaceId}
      defaultTitle={session.goal}
      isRepoMissing={isRepoMissing}
      isConnected={isConnected}
      onConnected={onConnected}
      onCreated={(created) => {
        follow({
          title: openedWord(created),
          target: { place: branchPlace({ sessionId: session.id, mountPath, tab: 'pr' }) },
        });
        onCreated();
      }}
    />
  );
};
