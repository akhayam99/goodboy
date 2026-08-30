import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { ProjectGitPill } from './ProjectGitPill';
import { ProjectGitSummaryPill } from './ProjectGitSummaryPill';

type Props = {
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
};

export const ProjectGitPills = ({ entries }: Props) => {
  if (entries.length >= 3) {
    return <ProjectGitSummaryPill entries={entries} />;
  }
  return (
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
};
