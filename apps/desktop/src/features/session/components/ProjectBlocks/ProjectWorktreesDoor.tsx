import type { ProjectId } from '@goodboy/types';
import { ProjectWorktreesForProject } from '../../../storage/ProjectWorktreesForProject';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly projectId: ProjectId;
  readonly projectName: string;
};

export const ProjectWorktreesDoor = ({ projectId, projectName }: Props) => {
  const { session } = useBoardContext();
  return (
    <ProjectWorktreesForProject
      projectId={projectId}
      projectName={projectName}
      hostSessionId={session.id}
    />
  );
};
