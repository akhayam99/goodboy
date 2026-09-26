import { useState } from 'react';
import type { Project } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { BaseBranchSelect } from '../../../worktree/BaseBranchSelect';
import { commitBaseBranch } from '../../../worktree/commitBaseBranch';

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
    setError(null);
    try {
      await commitBaseBranch({
        projectId: project.id,
        currentBaseBranch: project.baseBranch ?? null,
        candidate,
        updateProjectBaseBranch,
      });
    } catch (failure) {
      setError(formatError(failure));
    }
  };

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <BaseBranchSelect
        repoPath={project.rootPath}
        value={project.baseBranch ?? null}
        onCommit={(candidate) => commit({ candidate })}
      />
      {error != null ? (
        <span role="alert" className="text-secondary text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
};
