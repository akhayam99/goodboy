import { useState } from 'react';
import type { Project } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly project: Project;
};

export const ProjectBaseBranchInput = ({ project }: Props) => {
  const [value, setValue] = useState(project.baseBranch ?? '');
  const [error, setError] = useState<string | null>(null);
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);

  const commit = async () => {
    const baseBranch = value.trim() || null;
    if (baseBranch === project.baseBranch) {
      setValue(project.baseBranch ?? '');
      return;
    }
    setError(null);
    try {
      await updateProjectBaseBranch({ projectId: project.id, baseBranch });
      setValue(baseBranch ?? '');
    } catch (failure) {
      setError(formatError(failure));
    }
  };

  return (
    <span className="flex min-w-36 flex-col gap-1">
      <label className="flex items-center gap-2 text-2xs text-muted-foreground">
        <span className="shrink-0">Base branch</span>
        <input
          type="text"
          value={value}
          placeholder="main"
          aria-label={`${project.name} base branch`}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
      {error != null ? (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
};
