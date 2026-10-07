import { useState } from 'react';
import { Button, Notice, formatError } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { foreignCommitsBody, isWorktreeClean } from './foreignCommits';
import { useForeignCommits } from './useForeignCommits';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
};

export const ForeignCommitsNotice = ({ sessionId, row, status }: Props) => {
  const moveMountToRemoteCommits = useAppStore((state) => state.moveMountToRemoteCommits);
  const state = useForeignCommits({ row, status });
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === null || status === null) {
    return null;
  }

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
      title="This worktree is not on the PR's commits"
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
