import { useMemo } from 'react';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import { branchChoiceGroup, branchChoiceOrigin, type BranchChoice } from './branchChoices';
import { BRANCH_PICKER_MAX_WIDTH, branchPickerOption } from './branchPicker';
import type { LocalBranchInfo } from './worktree';

type PickableBranch = LocalBranchInfo & Partial<Omit<BranchChoice, keyof LocalBranchInfo>>;

type Props = {
  readonly branches: ReadonlyArray<PickableBranch>;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly excludeNames?: ReadonlyArray<string>;
  readonly emptyLabel?: string;
};

type PlaceholderParams = {
  readonly loading: boolean;
  readonly isEmpty: boolean;
  readonly emptyLabel: string;
};

const placeholderOf = ({ loading, isEmpty, emptyLabel }: PlaceholderParams): string => {
  if (loading) {
    return 'Loading branches';
  }
  if (isEmpty) {
    return emptyLabel;
  }
  return 'Choose a branch';
};

const branchMeta = ({ branch }: { branch: PickableBranch }): string | undefined => {
  const notes = [
    branchChoiceOrigin({
      choice: {
        author: branch.author ?? null,
        prNumber: branch.prNumber ?? null,
        isDraft: branch.isDraft ?? false,
      },
    }),
    branch.inUse ? 'in use' : null,
    branch.hasUncommitted ? 'dirty' : null,
  ].filter((note): note is string => note !== null);
  return notes.length === 0 ? undefined : notes.join(' · ');
};

const branchKeywords = ({ branch }: { branch: PickableBranch }): string | undefined => {
  const prNumber = branch.prNumber ?? null;
  const words = [
    branch.author ?? '',
    prNumber === null ? '' : `#${prNumber}`,
    prNumber === null ? '' : `${prNumber}`,
    branch.title ?? '',
  ].filter((word) => word !== '');
  return words.length === 0 ? undefined : words.join(' ');
};

export const BranchCombobox = ({
  branches,
  value,
  onChange,
  disabled,
  loading,
  excludeNames,
  emptyLabel = 'No local branches',
}: Props) => {
  const options = useMemo<ReadonlyArray<ListboxOption<string>>>(() => {
    const excluded = new Set(excludeNames ?? []);
    return branches
      .filter((branch) => !excluded.has(branch.name))
      .map((branch) => {
        const keywords = branchKeywords({ branch });
        return {
          ...branchPickerOption({ name: branch.name }),
          meta: branchMeta({ branch }),
          ...(branch.source === undefined
            ? {}
            : { group: branchChoiceGroup({ source: branch.source }) }),
          ...(keywords === undefined ? {} : { keywords }),
        };
      });
  }, [branches, excludeNames]);

  return (
    <Listbox
      ariaLabel="Branch"
      isBlock
      searchable
      searchLabel="Search branches"
      searchPlaceholder="Search branches"
      noun="branch"
      maxPopupWidth={BRANCH_PICKER_MAX_WIDTH}
      placeholder={placeholderOf({ loading, isEmpty: branches.length === 0, emptyLabel })}
      disabled={disabled || branches.length === 0}
      value={value === '' ? null : value}
      options={options}
      onChange={onChange}
    />
  );
};
