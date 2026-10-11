import { useCallback, useMemo } from 'react';
import { ErrorStrip, Skeleton } from '@goodboy/ui';
import { useSessionDiff } from '../../diff/hooks/useSessionDiff';
import { DiffView } from '../../diff/components/DiffView';
import { worktreeDiff } from '../../worktree/worktree';

type Props = {
  readonly sessionDir: string;
  readonly relPath: string;
  readonly baseBranch: string | null;
};

export const ExploreFileChanges = ({ sessionDir, relPath, baseBranch }: Props) => {
  const loader = useCallback(
    () => worktreeDiff({ worktreePath: sessionDir, baseBranch }),
    [sessionDir, baseBranch],
  );
  const diff = useSessionDiff({ sessionId: null, worktreePath: null, loader });
  const files = useMemo(
    () => diff.files.filter((file) => file.path === relPath),
    [diff.files, relPath],
  );

  if (diff.loading) {
    return (
      <div role="status" className="flex flex-col gap-2 p-3" aria-label="Loading changes">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-sm" />
        <Skeleton className="h-3 w-1/2 rounded-sm" />
      </div>
    );
  }
  if (diff.error !== null) {
    return (
      <div className="p-3">
        <ErrorStrip label="the changes" error={new Error(diff.error)} onRetry={diff.refresh} />
      </div>
    );
  }
  if (files.length === 0) {
    return <p className="p-4 text-body text-muted-foreground">This file has no changes here.</p>;
  }
  return <DiffView files={files} presentation="peek" />;
};
