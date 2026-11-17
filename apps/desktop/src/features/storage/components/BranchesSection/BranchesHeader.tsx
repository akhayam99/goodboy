import { ICON_SIZE, Listbox, SectionHeader, type ListboxOption } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { branchesMetaOf } from '../../branches/branchesMetaOf';
import type { BranchTab, ClassifiedBranch } from '../../branches/classifyBranch';

type Props = {
  readonly tab: BranchTab;
  readonly entries: ReadonlyArray<ClassifiedBranch> | null;
  readonly onTabChange: (tab: BranchTab) => void;
};

const TAB_OPTIONS: ReadonlyArray<ListboxOption<BranchTab>> = [
  { value: 'safe', label: 'Safe to delete' },
  { value: 'needs-look', label: 'Check first' },
  { value: 'all', label: 'All' },
];

const BranchIcon = CONCEPT_ICONS.branch;

export const BranchesHeader = ({ tab, entries, onTabChange }: Props) => (
  <SectionHeader
    label="Branches"
    headingLevel={2}
    icon={<BranchIcon size={ICON_SIZE.row} aria-hidden />}
    meta={
      entries === null ? undefined : (
        <span className="text-meta text-muted-foreground">{branchesMetaOf({ entries })}</span>
      )
    }
    action={
      <Listbox
        ariaLabel="Show branches"
        trigger="quiet"
        size="sm"
        value={tab}
        options={TAB_OPTIONS}
        onChange={onTabChange}
      />
    }
  />
);
