import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { PullRequestStart } from '../../../integrations/github/components/PullRequest/PullRequestStart';
import { CreateMrForm } from '../../../integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import type { PullRequestPrefill } from '../../pullRequestPrefillOf';

type Props = {
  readonly session: Session;
  readonly mountPath: string | null;
  readonly prefill: PullRequestPrefill;
  readonly submitVariant?: 'primary' | 'secondary';
  readonly trailing?: ReactNode;
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
  prefill,
  submitVariant = 'primary',
  trailing = null,
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
  const mountId = useAppStore((state) =>
    mountPath === null
      ? null
      : (selectMountForPath({ state, sessionId: session.id, path: mountPath })?.mountId ?? null),
  );
  const hostKind = useMountRemoteHostKind({ sessionId: session.id, repoRoot });
  if (hostKind === 'gitlab' && !isRepoMissing) {
    return (
      <CreateMrForm
        key={mountId ?? 'no-mount'}
        sessionId={session.id}
        mountId={mountId}
        defaultTitle={prefill.title}
        defaultBody={prefill.body}
        onCreated={onCreated}
      />
    );
  }
  return (
    <PullRequestStart
      key={mountId ?? 'no-mount'}
      sessionId={session.id}
      workspaceId={session.workspaceId}
      mountId={mountId}
      defaultTitle={prefill.title}
      defaultBody={prefill.body}
      submitVariant={submitVariant}
      trailing={trailing}
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
