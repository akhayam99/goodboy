import { useMemo } from 'react';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { useActionControls } from '../../../../actions/useActionControls';
import type { MountActionTarget } from '../../../../actions/types';
import { useMountRemoteHostKind } from '../../../../worktree/useMountRemoteHostKind';
import type { RemoteBranchState } from '../../../../worktree/worktree';
import { ClosedWorktreeNotice } from '../ClosedWorktreeNotice';
import { AlsoInChip } from '../ProjectMountRows/AlsoInChip';
import { ForeignCommitsNotice } from '../ProjectMountRows/ForeignCommitsNotice';
import { MountActionFailureNotice } from '../ProjectMountRows/MountActionFailureNotice';
import { MountBranchDecision } from '../ProjectMountRows/MountBranchDecision';
import { RebaseStoppedNotice } from '../ProjectMountRows/RebaseStoppedNotice';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly foreign: RemoteBranchState | null;
  readonly isMismatchDismissed: boolean;
  readonly onDismissMismatch: () => void;
};

export const MountNotices = ({
  sessionId,
  row,
  status,
  foreign,
  isMismatchDismissed,
  onDismissMismatch,
}: Props) => {
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: row.repoRoot });
  const target = useMemo<MountActionTarget>(
    () => ({ kind: 'mount', sessionId, mountId: row.mountId, status, remoteKind }),
    [remoteKind, row.mountId, sessionId, status],
  );
  const controls = useActionControls({ target });
  const worktreePath = row.worktreePath;
  const hasTools = row.projectKind === 'repo' && row.isAttached && worktreePath !== null;

  if (hasTools && status?.inProgress === 'rebase') {
    return (
      <RebaseStoppedNotice
        sessionId={sessionId}
        mountId={row.mountId}
        worktreePath={worktreePath}
        baseBranch={row.baseBranch}
        status={status}
        onOpenTerminal={() => controls.trigger({ actionId: 'mount.openTerminal' })}
      />
    );
  }

  return (
    <>
      {row.isAttached ? null : (
        <ClosedWorktreeNotice sessionId={sessionId} row={row} controls={controls} />
      )}
      {controls.failure === null ? null : (
        <MountActionFailureNotice projectName={row.projectName} controls={controls} />
      )}
      {hasTools && foreign !== null && status !== null ? (
        <ForeignCommitsNotice sessionId={sessionId} row={row} status={status} state={foreign} />
      ) : null}
      {row.projectKind === 'repo' && row.branch !== '' ? (
        <AlsoInChip sessionId={sessionId} projectId={row.projectId} branch={row.branch} />
      ) : null}
      {row.observation === null || isMismatchDismissed ? null : (
        <MountBranchDecision
          onDismiss={onDismissMismatch}
          sessionId={sessionId}
          mountId={row.mountId}
          projectName={row.projectName}
          repoRoot={row.repoRoot}
          worktreePath={row.worktreePath}
          observation={row.observation}
          holder={row.observedBranchHolder}
        />
      )}
    </>
  );
};
