import type { Project, ProjectId } from '@goodboy/types';
import { Select } from '@goodboy/ui';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: ProjectId;
  readonly ariaLabel: string;
  readonly onChange: (projectId: ProjectId) => void;
};

export const ProjectSelect = ({ projects, projectId, ariaLabel, onChange }: Props) => (
  <Select
    size="sm"
    value={projectId}
    aria-label={ariaLabel}
    onChange={(event) => onChange(event.target.value as ProjectId)}
  >
    {projects.map((project) => (
      <option key={project.id} value={project.id}>
        {project.name}
      </option>
    ))}
  </Select>
);
