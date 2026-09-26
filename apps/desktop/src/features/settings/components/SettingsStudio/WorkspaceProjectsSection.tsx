import { Star } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import { ProjectBaseBranchInput } from './ProjectBaseBranchInput';
import { WorkspaceEyebrow } from './WorkspaceEyebrow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProjectsSection = ({ workspaceId }: Props) => {
  const hasProjects = useAppStore((state) =>
    state.projects.some((project) => project.workspaceId === workspaceId),
  );
  return (
    <section aria-labelledby="workspace-projects" className="flex flex-col gap-2">
      <ProjectLinkList
        workspaceId={workspaceId}
        density="compact"
        heading={({ count }) => (
          <WorkspaceEyebrow id="workspace-projects" label="Projects" count={count} />
        )}
        emptyHint="No projects linked yet. Add a repository or a folder."
        rowAccessory={({ project }) =>
          project.kind === 'repo' && <ProjectBaseBranchInput project={project} />
        }
      />
      {hasProjects && (
        <p className="flex items-center gap-1.5 px-2 text-label text-faint-foreground">
          <Star size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          Starred projects come first for agents and in project pickers. Descriptions go into every
          agent's project list.
        </p>
      )}
    </section>
  );
};
