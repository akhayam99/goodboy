import { FolderGit2, FolderOpen } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { remoteLabel } from '../hostFromRemote';
import { useProjectRemote } from '../useProjectRemote';

export const FolderCard = ({
  project,
  busy,
  onChange,
}: {
  readonly project: Project;
  readonly busy: boolean;
  readonly onChange: () => void;
}) => {
  const remote = useProjectRemote({ project });
  const isRepo = project.kind === 'repo';
  const gitLine = ['Git', project.baseBranch ?? null, remoteLabel(remote)].filter(
    (part): part is string => part !== null && part !== '',
  );
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border-soft bg-subtle px-4 py-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {isRepo ? (
          <FolderGit2 size={ICON_SIZE.control} aria-hidden />
        ) : (
          <FolderOpen size={ICON_SIZE.control} aria-hidden />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-row text-foreground">{project.name}</span>
        <span className="truncate font-mono text-meta text-muted-foreground">
          {project.rootPath}
        </span>
        {isRepo ? (
          <span className="truncate text-meta text-faint-foreground">{gitLine.join(' · ')}</span>
        ) : (
          <span className="text-meta text-faint-foreground">
            Not a git folder. Agents read and write documents here. No branches or pull requests.
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onChange}>
        Change
      </Button>
    </li>
  );
};
