import type { Project, ProjectId } from '@goodboy/types';
import { Listbox } from '@goodboy/ui';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: ProjectId;
  readonly ariaLabel: string;
  readonly onChange: (projectId: ProjectId) => void;
};

export const ProjectSelect = ({ projects, projectId, ariaLabel, onChange }: Props) => (
  <Listbox
    size="sm"
    value={projectId}
    ariaLabel={ariaLabel}
    options={projects.map((project) => ({ value: project.id, label: project.name }))}
    onChange={onChange}
  />
);
