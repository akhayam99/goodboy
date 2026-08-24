import { useState } from 'react';
import { Folder, FolderGit2, GitBranch, X } from 'lucide-react';
import { Tooltip, cn, formatError } from '@goodboy/ui';
import type { SessionId, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import { useAppStore, type MountDiffStat } from '../../../../store';
import { DiffStat } from '../DiffStat';

const PRIMARY_HINT =
  'New agents and turns work in this project by default; other mounts stay writable';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly mount: SessionProjectMount;
  readonly name: string;
  readonly kind: string | null;
  readonly isPrimary: boolean;
  readonly isDirty: boolean;
  readonly stat: MountDiffStat | null;
  readonly onClose: () => void;
};

export const ProjectChipRow = ({
  sessionId,
  workspaceId,
  mount,
  name,
  kind,
  isPrimary,
  isDirty,
  stat,
  onClose,
}: Props) => {
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const detachProject = useAppStore((state) => state.detachProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isBusy, setIsBusy] = useState(false);
  const GlyphIcon = kind === 'repo' ? FolderGit2 : Folder;

  const makePrimary = () => {
    if (!isPrimary) {
      void setSessionActiveProject({ sessionId, projectId: mount.projectId });
    }
    onClose();
  };

  const detach = async () => {
    if (isDirty || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await detachProject({ sessionId, projectId: mount.projectId });
    } catch (error) {
      void emitNotification(
        'error',
        'warning',
        'could not detach the project',
        formatError(error),
        {
          sessionId,
          workspaceId,
        },
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-1 px-1.5">
      <Tooltip content={isPrimary ? PRIMARY_HINT : 'Make primary'} side="top">
        <button
          type="button"
          aria-label={isPrimary ? `${name}, primary project` : `Make ${name} primary`}
          aria-current={isPrimary || undefined}
          onClick={makePrimary}
          className={cn(
            'flex min-w-0 flex-1 items-start gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-foreground motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
            isPrimary && 'bg-muted/30',
          )}
        >
          <GlyphIcon size={13} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate">{name}</span>
              {stat != null ? (
                <DiffStat additions={stat.additions} deletions={stat.deletions} size="md" />
              ) : null}
            </span>
            {mount.branch !== '' ? (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <GitBranch size={10} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate font-mono">{mount.branch}</span>
              </span>
            ) : null}
          </span>
        </button>
      </Tooltip>
      <Tooltip
        content={isDirty ? 'Uncommitted changes keep this mount in place' : `Detach ${name}`}
        side="top"
      >
        <button
          type="button"
          aria-label={`Detach ${name}`}
          aria-disabled={isDirty || isBusy}
          onClick={() => void detach()}
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
            isDirty || isBusy
              ? 'text-muted-foreground/40'
              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
          )}
        >
          <X size={12} aria-hidden />
        </button>
      </Tooltip>
    </li>
  );
};
