import { useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { BaseBranchSelect } from '../../../worktree/BaseBranchSelect';

type Props = {
  readonly projectId: ProjectId;
  readonly repoPath: string;
  readonly value: string | null;
  readonly onDone: () => void;
};

export const DiffBaseBranchRow = ({ projectId, repoPath, value, onDone }: Props) => {
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const [error, setError] = useState<string | null>(null);

  const commit = async (candidate: string | null) => {
    const trimmed = candidate?.trim() ?? '';
    const next = trimmed === '' ? null : trimmed;
    if (next === value) {
      onDone();
      return;
    }
    try {
      await updateProjectBaseBranch({ projectId, baseBranch: next });
      setError(null);
      onDone();
    } catch (failure) {
      setError(formatError(failure));
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-3 text-meta">
        <span className="shrink-0 text-foreground">Compare with</span>
        <BaseBranchSelect repoPath={repoPath} value={value} onCommit={commit} />
        <Button size="sm" variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
