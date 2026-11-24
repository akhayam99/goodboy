import { Suspense, useMemo, useState } from 'react';
import { FolderPlus } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  IconButton,
  useDropdown,
  SkeletonRows,
} from '@goodboy/ui';
import type { SessionEvent, SessionId, WorkspaceId } from '@goodboy/types';
import { pendingMountProposals } from '../../../../../store/slices/project-mounts/materializationProposals';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../../store';
import { useRecentProjectIds } from '../../../../../shared/components/ProjectPicker/useRecentProjectIds';

import { NAMES } from '../../../../../shared/utils/names';
import { lazyNamed } from '../../../../../shared/lib/lazyNamed';
import { LevelAddTrigger } from '../../../../../shared/components/LevelAddTrigger';
import { isProjectInFirstLap } from '../../../../../store/slices/bootstrap/firstLap';

const MountProjectList = lazyNamed({
  load: () => import('./MountProjectList'),
  pick: ({ MountProjectList }) => MountProjectList,
});

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly presentation?: 'icon' | 'button' | 'add';
};

const LABEL = NAMES.mountAProject;

const NO_EVENTS: ReadonlyArray<SessionEvent> = [];

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
  const recentIds = useRecentProjectIds({ workspaceId });
  const events = useAppStore((state) => state.sessionEvents?.[sessionId] ?? NO_EVENTS);
  const requestedIds = useMemo(
    () => pendingMountProposals({ events }).map((proposal) => proposal.projectId),
    [events],
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
      bodyClassName="max-h-80"
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
            variant="quiet"
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
        <Suspense fallback={<SkeletonRows label="Loading folders" />}>
          <MountProjectList
            sessionId={sessionId}
            workspaceId={workspaceId}
            projects={availableProjects}
            recentIds={recentIds}
            requestedIds={requestedIds}
            emptyHint={
              hasWorkspaceProjects
                ? 'Every workspace folder is already mounted.'
                : 'This workspace has no folder yet.'
            }
            onDone={() => {
              setIsComplete(true);
              dropdown.close();
            }}
          />
        </Suspense>
      )}
    </AnchoredPopover>
  );
};
