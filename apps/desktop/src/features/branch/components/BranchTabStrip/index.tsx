import { PageTabs, StatusDot, cn, tintClasses, type PageTabOption } from '@goodboy/ui';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchTabEntry } from '../../branchTabs';
import type { BranchTabFacts } from '../../branchTabFactsOf';
import { DiffStatText } from '../../../../shared/components/DiffStatText';

type BranchTabLive = Readonly<Partial<Record<BranchTab, string>>>;

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly facts: BranchTabFacts;
  readonly live?: BranchTabLive;
  readonly value: BranchTab;
  readonly onSelect: (tab: BranchTab) => void;
};

const NO_LIVE: BranchTabLive = {};

export const BranchTabStrip = ({ tabs, facts, live = NO_LIVE, value, onSelect }: Props) => {
  if (tabs.length === 0) {
    return null;
  }
  const options = tabs.map((entry): PageTabOption<BranchTab> => {
    const fact = facts[entry.id];
    const phrase = live[entry.id] ?? null;
    const tooltip = phrase ?? fact.tooltip;
    return {
      value: entry.id,
      label: entry.label,
      ...(tooltip !== null && { tooltip }),
      ...((fact.text !== null || fact.diff !== null || phrase !== null) && {
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
            {phrase === null ? null : (
              <span data-tab-live={entry.id} className="flex">
                <StatusDot tone="info" size="sm" pulsing />
              </span>
            )}
          </span>
        ),
      }),
    };
  });
  return <PageTabs ariaLabel="Branch pages" options={options} value={value} onChange={onSelect} />;
};
