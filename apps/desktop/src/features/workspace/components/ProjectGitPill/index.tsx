import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { ProjectGitPill } from './ProjectGitPill';

type Props = {
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
};

export const ProjectGitPills = ({ entries }: Props) => (
  <>
    {entries.map(({ project, status }) => (
      <ProjectGitPill
        key={project.id}
        project={project}
        status={status}
        shouldShowProjectName={entries.length > 1}
      />
    ))}
  </>
);
