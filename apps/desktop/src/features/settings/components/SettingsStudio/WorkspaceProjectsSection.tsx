import type { WorkspaceId } from '@goodboy/types';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import { ProjectBaseBranchInput } from './ProjectBaseBranchInput';
import { WorkspaceEyebrow } from './WorkspaceEyebrow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProjectsSection = ({ workspaceId }: Props) => (
  <section aria-labelledby="workspace-projects" className="flex flex-col">
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
  </section>
);
