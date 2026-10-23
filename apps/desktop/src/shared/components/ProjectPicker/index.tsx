import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Chip, Listbox } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { ICON_SIZE } from '../conceptIcons';
import { projectPickerOptions } from './projectPickerOptions';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly value: ReadonlyArray<ProjectId>;
  readonly suggestedIds?: ReadonlyArray<ProjectId>;
  readonly isDisabled?: boolean;
  readonly emptyValueLabel?: string;
  readonly onChange: (projectIds: ReadonlyArray<ProjectId>) => void;
};

const NO_SUGGESTIONS: ReadonlyArray<ProjectId> = [];

export const ProjectPicker = ({
  projects,
  value,
  suggestedIds = NO_SUGGESTIONS,
  isDisabled = false,
  emptyValueLabel = 'No folder',
  onChange,
}: Props) => {
  const options = useMemo(
    () => projectPickerOptions({ projects, suggestedIds }),
    [projects, suggestedIds],
  );
  const picked = value.flatMap((id) => projects.filter((project) => project.id === id));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Listbox
        multiple
        ariaLabel="Folder"
        size="sm"
        isBlock
        popupWidth="trigger"
        searchable
        searchLabel="Search folders"
        searchPlaceholder="Search folders"
        emptyLabel="No folders in this workspace"
        noMatchLabel="No folders match"
        options={options}
        value={value}
        disabled={isDisabled}
        onChange={onChange}
        valueLabel={
          <span className="truncate text-muted-foreground">
            {picked.length === 0 ? emptyValueLabel : 'Add folder'}
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
              disabled={isDisabled}
              onClick={() => onChange(value.filter((id) => id !== project.id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
