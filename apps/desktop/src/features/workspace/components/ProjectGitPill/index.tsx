import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { ProjectGitPill } from './ProjectGitPill';
import { ProjectGitSummaryPill } from './ProjectGitSummaryPill';

type Props = {
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
  readonly isQuiet?: boolean;
};

export const ProjectGitPills = ({ entries, isQuiet = false }: Props) => {
  if (entries.length >= 3) {
    return <ProjectGitSummaryPill entries={entries} isQuiet={isQuiet} />;
  }
  return (
    <>
      {entries.map(({ project, status }) => (
        <ProjectGitPill
          key={project.id}
          project={project}
          status={status}
          shouldShowProjectName={entries.length > 1}
          isQuiet={isQuiet}
        />
      ))}
    </>
  );
};
