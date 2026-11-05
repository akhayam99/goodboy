import { SegmentedTabs, cn, tintClasses, type SegmentedTabOption } from '@goodboy/ui';
import { DiffStat } from '../../../../shared/components/DiffStat';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchTabEntry } from '../../branchTabs';
import type { WorktreeEntryFacts } from '../../worktreeEntryFacts';

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly facts: WorktreeEntryFacts;
  readonly value: BranchTab;
  readonly onSelect: (tab: BranchTab) => void;
};

export const BranchTabStrip = ({ tabs, facts, value, onSelect }: Props) => {
  const options = tabs.map((entry): SegmentedTabOption<BranchTab> => {
    const fact = facts[entry.id];
    const hasBadge = fact.text !== null || fact.diff !== null || fact.notPushed !== null;
    return {
      value: entry.id,
      label: entry.label,
      ...(fact.tooltip !== null && { tooltip: fact.tooltip }),
      ...(hasBadge && {
        badge: (
          <span data-tab-count="" className="flex items-center gap-2 text-meta tabular-nums">
            {fact.text === null ? null : (
              <span
                className={
                  fact.tone === null ? 'text-faint-foreground' : tintClasses(fact.tone).text
                }
              >
                {fact.text}
              </span>
            )}
            {fact.diff === null ? null : (
              <DiffStat
                additions={fact.diff.additions}
                deletions={fact.diff.deletions}
                size="inherit"
              />
            )}
            {fact.notPushed === null ? null : (
              <span data-tab-not-pushed="" className={cn(tintClasses('warning').text)}>
                {`↑${fact.notPushed}`}
              </span>
            )}
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
