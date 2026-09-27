import type { ProjectId } from '@goodboy/types';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { LaunchMount } from '../../../inbox/launchMountFor';

type Props = {
  readonly mount: LaunchMount;
  readonly selectedId: ProjectId | null;
  readonly disabled: boolean;
  readonly onChange: (projectId: ProjectId | null) => void;
};

const NO_PROJECT = '';

export const LaunchMountRow = ({ mount, selectedId, disabled, onChange }: Props) => {
  const selected = mount.options.find((option) => option.projectId === selectedId) ?? null;
  const options: ReadonlyArray<ListboxOption<string>> = [
    ...mount.options.map((option) => ({ value: option.projectId, label: option.name })),
    { value: NO_PROJECT, label: 'No project' },
  ];
  const ProjectIcon = CONCEPT_ICONS.projectRepo;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-2 text-secondary text-muted-foreground">
      <Listbox
        trigger="chip"
        size="sm"
        ariaLabel="Project to work in"
        disabled={disabled}
        value={selected === null ? NO_PROJECT : selected.projectId}
        options={options}
        valueLabel={
          <>
            <ProjectIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="truncate">
              {selected === null ? 'No project' : `Works in ${selected.name}`}
            </span>
          </>
        }
        onChange={(value) => onChange(value === NO_PROJECT ? null : (value as ProjectId))}
      />
      {selected !== null ? (
        <span className="min-w-0 text-faint-foreground">{mount.reason}</span>
      ) : null}
    </div>
  );
};
