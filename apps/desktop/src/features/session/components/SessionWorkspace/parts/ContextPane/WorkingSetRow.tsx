import { Folder, FolderGit2, GitBranch } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import type { SessionProjectMount } from '@goodboy/types';

type Props = {
  readonly mount: SessionProjectMount;
  readonly kind: 'repo' | 'folder';
  readonly isActive: boolean;
};

export const WorkingSetRow = ({ mount, kind, isActive }: Props) => {
  const GlyphIcon = kind === 'repo' ? FolderGit2 : Folder;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <GlyphIcon size={13} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium text-foreground">{mount.mountName}</span>
        {mount.branch !== '' ? (
          <span className="flex shrink-0 items-center gap-1 text-2xs text-muted-foreground">
            <GitBranch size={10} aria-hidden />
            <span className="font-mono">{mount.branch}</span>
          </span>
        ) : null}
        {isActive ? <Chip tone="primary" size="xs" label="Active" className="shrink-0" /> : null}
      </div>
      <span className="truncate font-mono text-2xs text-muted-foreground/70">
        {mount.worktreePath}
      </span>
    </div>
  );
};
