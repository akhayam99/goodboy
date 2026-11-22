import { useShallow } from 'zustand/react/shallow';
import type { Project, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { MountActionsMenu } from '../SessionOverviewPane/ProjectMountRows/MountActionsMenu';
import { sessionProjectIdsOf } from './sessionProjectIdsOf';

type Props = {
  readonly sessionId: SessionId;
};

export const BoardProjectRemovals = ({ sessionId }: Props) => {
  const projects = useAppStore(
    useShallow((state) =>
      sessionProjectIdsOf({ state, sessionId }).flatMap((projectId): ReadonlyArray<Project> => {
        const project = projectById(state.projects, projectId);
        return project === undefined ? [] : [project];
      }),
    ),
  );
  if (projects.length === 0) {
    return null;
  }
  return (
    <div data-board-project-removals="" className="absolute right-0 top-0 flex">
      {projects.map((project) => (
        <MountActionsMenu
          key={project.id}
          sessionId={sessionId}
          projectId={project.id}
          workspaceId={project.workspaceId}
          projectName={project.name}
          worktreePath={project.rootPath}
          isTriggerShown={false}
        />
      ))}
    </div>
  );
};
