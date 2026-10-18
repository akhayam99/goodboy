import { useMemo, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { AnchoredPopover, Button, IconButton, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../../store';
import { MountProjectList } from './MountProjectList';
import { starredProjectsFirst } from '../../../../../shared/utils/starredProjectsFirst';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../shared/names';
import { LevelAddTrigger } from '../../../../../shared/components/LevelAddTrigger';
import { isProjectInFirstLap } from '../../../../../store/slices/bootstrap/firstLap';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly presentation?: 'icon' | 'button' | 'add';
};

const LABEL = NAMES.addFolder;

export const MountProjectAction = ({ sessionId, workspaceId, presentation = 'icon' }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 320 });
  const [isComplete, setIsComplete] = useState(false);
  const availableProjects = useAppStore(
    useShallow((state) => {
      const mounts = state.sessionProjectMounts[sessionId] ?? [];
      return state.projects.filter(
        (project) =>
          project.workspaceId === workspaceId &&
          !isProjectInFirstLap({ state, projectId: project.id }) &&
          mounts.every((mount) => mount.projectId !== project.id),
      );
    }),
  );
  const orderedProjects = useMemo(
    () => starredProjectsFirst({ projects: availableProjects, inside: 'recency' }),
    [availableProjects],
  );
  const hasWorkspaceProjects = useAppStore((state) =>
    state.projects.some((project) => project.workspaceId === workspaceId),
  );
  const toggle = () => {
    setIsComplete(false);
    dropdown.toggle();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={LABEL}
      anchorClassName="shrink-0"
      trigger={
        presentation === 'add' ? (
          <LevelAddTrigger ariaLabel={LABEL} isExpanded={dropdown.open} onClick={toggle} />
        ) : presentation === 'icon' ? (
          <IconButton
            size="xs"
            variant="ghost"
            icon={FolderPlus}
            iconSize={ICON_SIZE.row}
            label={LABEL}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={toggle}
            className="shrink-0"
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={LABEL}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={toggle}
          >
            <FolderPlus size={ICON_SIZE.row} aria-hidden />
            {LABEL}
          </Button>
        )
      }
    >
      {isComplete ? null : (
        <MountProjectList
          sessionId={sessionId}
          workspaceId={workspaceId}
          projects={orderedProjects}
          emptyHint={
            hasWorkspaceProjects
              ? 'Every workspace folder is already in this session.'
              : 'This workspace has no folder yet.'
          }
          onDone={() => {
            setIsComplete(true);
            dropdown.close();
          }}
        />
      )}
    </AnchoredPopover>
  );
};
