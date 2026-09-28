import { Listbox } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import type { SearchProjectOption } from '../../grammar';
import type { SearchChip } from '../../searchChips';
import {
  DATE_OPTIONS,
  PROVIDER_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  chipValue,
  dateChipOf,
  projectChipOf,
  providerChipOf,
  statusChipOf,
  typeChipOf,
} from '../../searchFilterOptions';

export type FilterGroup = 'type' | 'project' | 'provider' | 'status' | 'date';

type ChipParams = {
  readonly chip: SearchChip;
};

export const filterGroupOf = ({ chip }: ChipParams): FilterGroup => {
  switch (chip.key) {
    case 'type':
    case 'project':
    case 'provider':
    case 'status':
      return chip.key;
    case 'archived':
      return 'status';
    case 'after':
    case 'before':
      return 'date';
    default: {
      const exhaustive: never = chip;
      return exhaustive;
    }
  }
};

type Props = {
  readonly chips: ReadonlyArray<SearchChip>;
  readonly projects: ReadonlyArray<SearchProjectOption>;
  readonly now: number;
  readonly onGroupChange: (params: GroupChangeParams) => void;
};

export type GroupChangeParams = {
  readonly group: FilterGroup;
  readonly chips: ReadonlyArray<SearchChip>;
};

type ValuesParams = {
  readonly chips: ReadonlyArray<SearchChip>;
  readonly group: FilterGroup;
};

const valuesOf = ({ chips, group }: ValuesParams): ReadonlyArray<string> =>
  chips.filter((chip) => filterGroupOf({ chip }) === group).map((chip) => chipValue({ chip }));

type PresentParams = {
  readonly chip: SearchChip | null;
};

const present = ({ chip }: PresentParams): ReadonlyArray<SearchChip> =>
  chip === null ? [] : [chip];

export const SearchFilterBar = ({ chips, projects, now, onGroupChange }: Props) => {
  const dateValue = valuesOf({ chips, group: 'date' })[0] ?? null;
  return (
    <div
      role="group"
      aria-label="Filters"
      className="flex flex-wrap items-center gap-2 border-b border-border-soft px-4 py-2"
    >
      <Listbox
        multiple
        trigger="chip"
        size="sm"
        placeholder="Type"
        ariaLabel="Filter by type"
        options={TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        value={valuesOf({ chips, group: 'type' })}
        onChange={(values) =>
          onGroupChange({
            group: 'type',
            chips: values.flatMap((value) => present({ chip: typeChipOf({ value }) })),
          })
        }
      />
      <Listbox
        multiple
        trigger="chip"
        size="sm"
        placeholder="Project"
        ariaLabel="Filter by project"
        searchable
        noun="project"
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
        value={valuesOf({ chips, group: 'project' })}
        onChange={(values) =>
          onGroupChange({
            group: 'project',
            chips: values.map((value) =>
              projectChipOf({
                projectId: value as ProjectId,
                name: projects.find((project) => project.id === value)?.name ?? value,
              }),
            ),
          })
        }
      />
      <Listbox
        multiple
        trigger="chip"
        size="sm"
        placeholder="Provider"
        ariaLabel="Filter by provider"
        options={PROVIDER_OPTIONS}
        value={valuesOf({ chips, group: 'provider' })}
        onChange={(values) =>
          onGroupChange({
            group: 'provider',
            chips: values.flatMap((value) => present({ chip: providerChipOf({ value }) })),
          })
        }
      />
      <Listbox
        multiple
        trigger="chip"
        size="sm"
        placeholder="Status"
        ariaLabel="Filter by status"
        options={STATUS_OPTIONS}
        value={valuesOf({ chips, group: 'status' })}
        onChange={(values) =>
          onGroupChange({
            group: 'status',
            chips: values.flatMap((value) => present({ chip: statusChipOf({ value }) })),
          })
        }
      />
      <Listbox
        trigger="chip"
        size="sm"
        placeholder="Date"
        ariaLabel="Filter by date"
        options={DATE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        value={dateValue}
        onChange={(value) =>
          onGroupChange({ group: 'date', chips: present({ chip: dateChipOf({ value, now }) }) })
        }
      />
    </div>
  );
};
