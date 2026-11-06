import { useState } from 'react';
import { Button, Notice, formatError } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import type { RemoteBranchState } from '../../../../worktree/worktree';
import { foreignCommitsBody, isWorktreeClean } from './foreignCommits';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus;
  readonly state: RemoteBranchState;
};

export const ForeignCommitsNotice = ({ sessionId, row, status, state }: Props) => {
  const moveMountToRemoteCommits = useAppStore((store) => store.moveMountToRemoteCommits);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClean = isWorktreeClean({ status });
  const move = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await moveMountToRemoteCommits({ sessionId, mountId: row.mountId });
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Notice
      tone="warning"
      placement="inline"
      role="status"
      title="This worktree isn't on the PR's commits"
      body={
        error === null
          ? foreignCommitsBody({
              branch: row.branch,
              remoteAhead: state.remoteAhead,
              isClean,
            })
          : error
      }
      actions={
        <Button size="sm" disabled={!isClean || isBusy} onClick={() => void move()}>
          <span className={isBusy ? 'text-shimmer' : undefined}>Use the PR&apos;s commits</span>
        </Button>
      }
    />
  );
};
