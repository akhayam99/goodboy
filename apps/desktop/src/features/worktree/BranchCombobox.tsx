import { useMemo } from 'react';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { LocalBranchInfo } from './worktree';

type Props = {
  readonly branches: ReadonlyArray<LocalBranchInfo>;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly excludeNames?: ReadonlyArray<string>;
};

type PlaceholderParams = {
  readonly loading: boolean;
  readonly isEmpty: boolean;
};

const placeholderOf = ({ loading, isEmpty }: PlaceholderParams): string => {
  if (loading) {
    return 'Loading branches';
  }
  if (isEmpty) {
    return 'No local branches';
  }
  return 'Choose a branch';
};

const branchMeta = ({ branch }: { branch: LocalBranchInfo }): string | undefined => {
  const notes = [branch.inUse ? 'in use' : null, branch.hasUncommitted ? 'dirty' : null].filter(
    (note): note is string => note !== null,
  );
  return notes.length === 0 ? undefined : notes.join(' · ');
};

export const BranchCombobox = ({
  branches,
  value,
  onChange,
  disabled,
  loading,
  excludeNames,
}: Props) => {
  const options = useMemo<ReadonlyArray<ListboxOption<string>>>(() => {
    const excluded = new Set(excludeNames ?? []);
    return branches
      .filter((branch) => !excluded.has(branch.name))
      .map((branch) => ({
        value: branch.name,
        label: branch.name,
        isCode: true,
        meta: branchMeta({ branch }),
      }));
  }, [branches, excludeNames]);

  return (
    <Listbox
      ariaLabel="Branch"
      isBlock
      searchable
      searchLabel="Search branches"
      searchPlaceholder="Search branches"
      noun="branch"
      placeholder={placeholderOf({ loading, isEmpty: branches.length === 0 })}
      disabled={disabled || branches.length === 0}
      value={value === '' ? null : value}
      options={options}
      onChange={onChange}
    />
  );
};
