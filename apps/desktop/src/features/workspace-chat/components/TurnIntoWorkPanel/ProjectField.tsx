import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Chip, Listbox, type ListboxOption } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { ICON_SIZE, projectGlyph } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly value: ReadonlyArray<ProjectId>;
  readonly onChange: (projectIds: ReadonlyArray<ProjectId>) => void;
};

export const ProjectField = ({ projects, value, onChange }: Props) => {
  const options = useMemo(
    (): ReadonlyArray<ListboxOption<ProjectId>> =>
      projects.map((project) => {
        const Glyph = projectGlyph({ kind: project.kind });
        return {
          value: project.id,
          label: project.name,
          leading: <Glyph size={ICON_SIZE.row} aria-hidden />,
        };
      }),
    [projects],
  );
  const picked = projects.filter((project) => value.includes(project.id));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Listbox
        multiple
        ariaLabel="Project"
        size="sm"
        isBlock
        popupWidth="trigger"
        searchable
        searchLabel="Search projects"
        searchPlaceholder="Search projects"
        emptyLabel="No projects in this workspace"
        noMatchLabel="No projects match"
        options={options}
        value={value}
        onChange={onChange}
        valueLabel={
          <span className="truncate text-muted-foreground">
            {picked.length === 0 ? 'No project' : 'Add project'}
          </span>
        }
      />
      {picked.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {picked.map((project) => (
            <Chip
              key={project.id}
              as="button"
              tone="neutral"
              shape="badge"
              kind="reference"
              label={project.name}
              ariaLabel={`Remove ${project.name}`}
              trailing={<X size={ICON_SIZE.row} aria-hidden />}
              onClick={() => onChange(value.filter((id) => id !== project.id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
