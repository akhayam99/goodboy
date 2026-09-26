import { useMemo, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { AnchoredPopover, Button, IconButton, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../../store';
import { MountProjectList } from './MountProjectList';
import { starredProjectsFirst } from '../../../../../shared/utils/starredProjectsFirst';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly presentation?: 'icon' | 'button';
};

const emptyPickerMessage = ({
  hasWorkspaceProjects,
}: {
  readonly hasWorkspaceProjects: boolean;
}): string =>
  hasWorkspaceProjects
    ? 'Every workspace project is already in this session.'
    : 'Add a project in workspace settings to use it here.';

export const MountProjectAction = ({ sessionId, workspaceId, presentation = 'icon' }: Props) => {
  const dropdown = useDropdown({ width: 'w-80', expectedHeight: 320 });
  const [isComplete, setIsComplete] = useState(false);
  const availableProjects = useAppStore(
    useShallow((state) => {
      const mounts = state.sessionProjectMounts[sessionId] ?? [];
      return state.projects.filter(
        (project) =>
          project.workspaceId === workspaceId &&
          mounts.every((mount) => mount.projectId !== project.id),
      );
    }),
  );
  const orderedProjects = useMemo(
    () => starredProjectsFirst({ projects: availableProjects }),
    [availableProjects],
  );
  const hasWorkspaceProjects = useAppStore((state) =>
    state.projects.some((project) => project.workspaceId === workspaceId),
  );
  const label = 'Add project';

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={label}
      anchorClassName="shrink-0"
      trigger={
        presentation === 'icon' ? (
          <IconButton
            variant="ghost"
            icon={FolderPlus}
            iconSize={ICON_SIZE.row}
            label={label}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={() => {
              setIsComplete(false);
              dropdown.toggle();
            }}
            className="size-6 shrink-0"
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={() => {
              setIsComplete(false);
              dropdown.toggle();
            }}
          >
            <FolderPlus size={ICON_SIZE.row} aria-hidden />
            {label}
          </Button>
        )
      }
    >
      {availableProjects.length === 0 || isComplete ? (
        <div className="flex flex-col gap-2 px-3 py-2">
          <p className="text-label text-muted-foreground">
            {emptyPickerMessage({ hasWorkspaceProjects })}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              dropdown.close();
              window.dispatchEvent(
                new CustomEvent('goodboy:open-settings', {
                  detail: { scope: 'workspace', section: 'projects' },
                }),
              );
            }}
          >
            Add workspace project
          </Button>
        </div>
      ) : (
        <MountProjectList
          sessionId={sessionId}
          projects={orderedProjects}
          onDone={() => {
            setIsComplete(true);
            dropdown.close();
          }}
        />
      )}
    </AnchoredPopover>
  );
};
