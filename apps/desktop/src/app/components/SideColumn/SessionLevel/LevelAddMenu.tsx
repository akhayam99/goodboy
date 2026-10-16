import { useMemo } from 'react';
import { FolderPlus, GitFork, Plus, Settings2 } from 'lucide-react';
import { AnchoredPopover, Chip, MenuList, useDropdown, type MenuEntry } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { dispatchAfterNavigation } from '../../../../features/actions/dispatchAfterNavigation';
import { MountProjectAction } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';
import { NewBranchMountAction } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/NewBranchMountAction';
import { openWorkspaceProjects } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/openWorkspaceProjects';
import { levelAddEventName } from './levelAddEventName';

export type BranchableProject = {
  readonly projectId: ProjectId;
  readonly projectName: string;
};

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly projects: ReadonlyArray<BranchableProject>;
};

const MENU_LABEL = 'Add to this session';

export const LevelAddMenu = ({ sessionId, workspaceId, projects }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'min-w-[200px] max-w-sm' });
  const entries = useMemo<ReadonlyArray<MenuEntry>>(
    () => [
      {
        kind: 'item',
        key: 'add-project',
        label: 'Add project',
        icon: FolderPlus,
        onSelect: () =>
          dispatchAfterNavigation({ name: levelAddEventName({ sessionId, projectId: null }) }),
      },
      {
        kind: 'item',
        key: 'add-workspace-project',
        label: 'Add workspace project',
        icon: Settings2,
        onSelect: openWorkspaceProjects,
      },
      ...projects.map((project): MenuEntry => ({
        kind: 'item',
        key: `new-branch-${project.projectId}`,
        label: `${NAMES.newBranch} in ${project.projectName}`,
        icon: GitFork,
        onSelect: () =>
          dispatchAfterNavigation({
            name: levelAddEventName({ sessionId, projectId: project.projectId }),
          }),
      })),
    ],
    [projects, sessionId],
  );

  return (
    <div className="relative flex shrink-0 items-center">
      <AnchoredPopover
        dropdown={dropdown}
        anchorClassName="shrink-0"
        trigger={
          <Chip
            as="button"
            tone="neutral"
            shape="badge"
            kind="reference"
            ariaLabel={MENU_LABEL}
            hasPopup="menu"
            expanded={dropdown.open}
            onClick={dropdown.toggle}
            icon={<Plus size={ICON_SIZE.row} aria-hidden />}
            label="Add"
          />
        }
      >
        <MenuList label={MENU_LABEL} entries={entries} onClose={dropdown.close} />
      </AnchoredPopover>
      <div className="absolute right-0 top-full flex h-0 w-0">
        <MountProjectAction
          sessionId={sessionId}
          workspaceId={workspaceId}
          presentation="anchor"
          openEvent={levelAddEventName({ sessionId, projectId: null })}
        />
        {projects.map((project) => (
          <NewBranchMountAction
            key={project.projectId}
            sessionId={sessionId}
            projectId={project.projectId}
            projectName={project.projectName}
            presentation="anchor"
            openEvent={levelAddEventName({ sessionId, projectId: project.projectId })}
          />
        ))}
      </div>
    </div>
  );
};
