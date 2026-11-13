import { PageTabs, cn, tintClasses, type PageTabOption } from '@goodboy/ui';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchTabEntry } from '../../branchTabs';
import type { BranchTabFacts } from '../../branchTabFactsOf';
import { DiffStatText } from '../../../../shared/components/DiffStatText';

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly facts: BranchTabFacts;
  readonly value: BranchTab;
  readonly onSelect: (tab: BranchTab) => void;
};

export const BranchTabStrip = ({ tabs, facts, value, onSelect }: Props) => {
  const options = tabs.map((entry): PageTabOption<BranchTab> => {
    const fact = facts[entry.id];
    return {
      value: entry.id,
      label: entry.label,
      ...(fact.tooltip !== null && { tooltip: fact.tooltip }),
      ...((fact.text !== null || fact.diff !== null) && {
        badge: (
          <span
            data-tab-count=""
            className={cn(
              'flex items-center gap-1 text-meta tabular-nums',
              fact.tone === null ? 'text-faint-foreground' : tintClasses(fact.tone).text,
            )}
          >
            {fact.text}
            {fact.diff === null ? null : <DiffStatText diff={fact.diff} />}
          </span>
        ),
      }),
    };
  });
  return <PageTabs ariaLabel="Branch pages" options={options} value={value} onChange={onSelect} />;
};
