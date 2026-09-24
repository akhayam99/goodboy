import type { WorkspaceId } from '@goodboy/types';
import { SectionSurface } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import { ProjectBaseBranchInput } from './ProjectBaseBranchInput';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProjectsSection = ({ workspaceId }: Props) => (
  <SectionSurface
    label="Projects"
    hint="The repositories and folders this workspace works on."
    icon={<CONCEPT_ICONS.projectRepo size={ICON_SIZE.row} aria-hidden />}
    headingLevel={2}
  >
    <ProjectLinkList
      workspaceId={workspaceId}
      emptyHint="No projects linked yet. Add a repository below."
      rowAccessory={({ project }) =>
        project.kind === 'repo' && <ProjectBaseBranchInput project={project} />
      }
    />
  </SectionSurface>
);
