import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { AnchoredPopover, Tooltip, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../../store';
import { MountProjectList } from './MountProjectList';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly presentation?: 'icon' | 'button';
};

export const MountProjectAction = ({ sessionId, workspaceId, presentation = 'icon' }: Props) => {
  const dropdown = useDropdown({ width: 'w-80', expectedHeight: 320 });
  const [isComplete, setIsComplete] = useState(false);
  const projects = useAppStore(
    useShallow((state) => {
      const mounts = state.sessionProjectMounts[sessionId] ?? [];
      return state.projects.filter(
        (project) =>
          project.workspaceId === workspaceId &&
          mounts.every((mount) => mount.projectId !== project.id),
      );
    }),
  );
  const label = presentation === 'icon' ? 'Mount a project' : 'Mount project';

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Mount a project"
      trigger={
        <Tooltip content="Mount a project">
          <button
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={() => {
              setIsComplete(false);
              dropdown.toggle();
            }}
            className={
              presentation === 'icon'
                ? 'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]'
                : 'inline-flex h-7 items-center gap-1.5 rounded-md border border-border-soft px-2.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]'
            }
          >
            <FolderPlus size={ICON_SIZE.row} aria-hidden />
            {presentation === 'button' ? <span>{label}</span> : null}
          </button>
        </Tooltip>
      }
    >
      {projects.length === 0 || isComplete ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Every workspace project is already mounted
        </p>
      ) : (
        <MountProjectList
          sessionId={sessionId}
          projects={projects}
          onDone={() => {
            setIsComplete(true);
            dropdown.close();
          }}
        />
      )}
    </AnchoredPopover>
  );
};
