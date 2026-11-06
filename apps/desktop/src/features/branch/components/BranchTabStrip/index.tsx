import { SegmentedTabs, cn, tintClasses, type SegmentedTabOption } from '@goodboy/ui';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchTabEntry } from '../../branchTabs';
import { wantsYouFactsOf, type WorktreeEntryFacts } from '../../worktreeEntryFacts';

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly facts: WorktreeEntryFacts;
  readonly value: BranchTab;
  readonly onSelect: (tab: BranchTab) => void;
};

export const BranchTabStrip = ({ tabs, facts, value, onSelect }: Props) => {
  const quiet = wantsYouFactsOf({ facts });
  const options = tabs.map((entry): SegmentedTabOption<BranchTab> => {
    const fact = quiet[entry.id];
    return {
      value: entry.id,
      label: entry.label,
      ...(fact.tooltip !== null && { tooltip: fact.tooltip }),
      ...(fact.text !== null && {
        badge: (
          <span
            data-tab-count=""
            className={cn(
              'text-meta tabular-nums',
              fact.tone === null ? 'text-faint-foreground' : tintClasses(fact.tone).text,
            )}
          >
            {fact.text}
          </span>
        ),
      }),
    };
  });
  return (
    <SegmentedTabs
      ariaLabel="Branch pages"
      options={options}
      value={value}
      onChange={onSelect}
      size="sm"
    />
  );
};
