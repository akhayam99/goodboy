import type { WorkspaceId } from '@goodboy/types';
import { SectionHeader } from '@goodboy/ui';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import { ProjectBaseBranchInput } from './ProjectBaseBranchInput';
import { ProjectSetupCommandField } from './ProjectSetupCommandField';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProjectsSection = ({ workspaceId }: Props) => (
  <section id="projects" className="flex flex-col gap-4">
    <SectionHeader label="Projects" hint="The repositories and folders this workspace works on." />
    <ProjectLinkList
      workspaceId={workspaceId}
      emptyHint="No projects linked yet. Add a repository below."
      rowAccessory={({ project }) =>
        project.kind === 'repo' && <ProjectBaseBranchInput project={project} />
      }
      rowDetail={({ project }) =>
        project.kind === 'repo' && <ProjectSetupCommandField project={project} />
      }
    />
  </section>
);
