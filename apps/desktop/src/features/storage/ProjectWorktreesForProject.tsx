import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectProjectById } from '../../store/slices/projects/selectProjectById';
import { ProjectWorktrees } from './components/ProjectWorktrees';

type Props = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly hostSessionId: SessionId;
};

export const ProjectWorktreesForProject = ({ projectId, projectName, hostSessionId }: Props) => {
  const project = useAppStore((state) => selectProjectById(state, projectId));
  if (project === null || project.kind !== 'repo') {
    return null;
  }
  return (
    <ProjectWorktrees
      projectId={projectId}
      projectName={projectName}
      repoRoot={project.rootPath}
      workspaceId={project.workspaceId}
      hostSessionId={hostSessionId}
    />
  );
};
