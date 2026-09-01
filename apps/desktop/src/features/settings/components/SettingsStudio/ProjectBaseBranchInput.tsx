import { useState } from 'react';
import type { Project } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { BaseBranchSelect } from '../../../worktree/BaseBranchSelect';

type Props = {
  readonly project: Project;
};

type CommitParams = {
  readonly candidate: string | null;
};

export const ProjectBaseBranchInput = ({ project }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);

  const commit = async ({ candidate }: CommitParams) => {
    const trimmed = candidate?.trim() ?? '';
    const baseBranch = trimmed === '' ? null : trimmed;
    if (baseBranch === (project.baseBranch ?? null)) {
      return;
    }
    setError(null);
    try {
      await updateProjectBaseBranch({ projectId: project.id, baseBranch });
    } catch (failure) {
      setError(formatError(failure));
    }
  };

  return (
    <span className="flex min-w-36 flex-col gap-1">
      <span className="flex items-center gap-2 text-2xs text-muted-foreground">
        <span className="shrink-0">Base branch</span>
        <BaseBranchSelect
          repoPath={project.rootPath}
          value={project.baseBranch ?? null}
          onCommit={(candidate) => commit({ candidate })}
        />
      </span>
      {error != null ? (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
};
