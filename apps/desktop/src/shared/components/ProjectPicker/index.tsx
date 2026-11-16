import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Chip, ICON_SIZE, Listbox } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';

import { projectPickerOptions } from './projectPickerOptions';
import { ProjectStarHint } from './ProjectStarHint';
import { useProjectStarToggle } from './useProjectStarToggle';
import { useRecentProjectIds } from './useRecentProjectIds';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly value: ReadonlyArray<ProjectId>;
  readonly isDisabled?: boolean;
  readonly emptyValueLabel?: string;
  readonly onChange: (projectIds: ReadonlyArray<ProjectId>) => void;
};

export const ProjectPicker = ({
  projects,
  value,
  isDisabled = false,
  emptyValueLabel = 'No folder',
  onChange,
}: Props) => {
  const recentIds = useRecentProjectIds({ workspaceId: projects[0]?.workspaceId ?? null });
  const stars = useProjectStarToggle();
  const options = useMemo(
    () => projectPickerOptions({ projects, recentIds, stars }),
    [projects, recentIds, stars],
  );
  const hasStarred = projects.some((project) => project.starredAt !== undefined);
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
        status={
          stars.failure === null ? undefined : (
            <span role="alert" className="text-danger">
              {stars.failure}
            </span>
          )
        }
        footer={hasStarred || projects.length === 0 ? undefined : () => <ProjectStarHint />}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            stars.dismiss();
          }
        }}
        valueLabel={
          <span className="truncate text-muted-foreground">
            {picked.length === 0 ? emptyValueLabel : 'Add project'}
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
