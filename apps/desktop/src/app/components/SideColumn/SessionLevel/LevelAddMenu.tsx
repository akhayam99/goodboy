import { FolderPlus, GitFork, Plus, Settings2, type LucideIcon } from 'lucide-react';
import { AnchoredPopover, Button, Chip, useDropdown } from '@goodboy/ui';
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

type Choice = {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly run: () => void;
};

const PANEL_LABEL = 'Add to this session';

export const LevelAddMenu = ({ sessionId, workspaceId, projects }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'min-w-[200px] max-w-sm' });
  const choices: ReadonlyArray<Choice> = [
    {
      key: 'add-project',
      label: 'Add project',
      icon: FolderPlus,
      run: () =>
        dispatchAfterNavigation({ name: levelAddEventName({ sessionId, projectId: null }) }),
    },
    {
      key: 'add-workspace-project',
      label: 'Add workspace project',
      icon: Settings2,
      run: openWorkspaceProjects,
    },
    ...projects.map((project): Choice => ({
      key: `new-branch-${project.projectId}`,
      label: `${NAMES.newBranch} in ${project.projectName}`,
      icon: GitFork,
      run: () =>
        dispatchAfterNavigation({
          name: levelAddEventName({ sessionId, projectId: project.projectId }),
        }),
    })),
  ];

  return (
    <div className="relative flex shrink-0 items-center">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel={PANEL_LABEL}
        anchorClassName="shrink-0"
        trigger={
          <Chip
            as="button"
            tone="neutral"
            shape="badge"
            kind="reference"
            ariaLabel={PANEL_LABEL}
            hasPopup="dialog"
            expanded={dropdown.open}
            onClick={dropdown.toggle}
            icon={<Plus size={ICON_SIZE.row} aria-hidden />}
            label="Add"
          />
        }
      >
        <div className="flex flex-col p-1">
          {choices.map((choice) => (
            <Button
              key={choice.key}
              size="sm"
              variant="ghost"
              className="justify-start"
              onClick={() => {
                dropdown.close();
                choice.run();
              }}
            >
              <choice.icon size={ICON_SIZE.row} aria-hidden />
              {choice.label}
            </Button>
          ))}
        </div>
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
