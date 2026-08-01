import { useMemo, useState } from 'react';
import { EmptyState, cn, formatTokens, formatUsdPrecise } from '@goodboy/ui';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { sortTurns, type SortKey, type WorkspaceTurn } from './lib';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly showSession: boolean;
};

const SORT_KEY_STORAGE = STORAGE_KEYS.pricingSortKey;
const PAGE_SIZE = 10;

export const TurnsTable = ({ turns, showSession }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem(SORT_KEY_STORAGE);
    return stored === 'expensive' ? 'expensive' : 'recent';
  });
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sorted = useMemo(() => sortTurns(turns, sortKey), [turns, sortKey]);
  const shown = sorted.slice(0, visible);
  const remaining = sorted.length - shown.length;

  const handleSortKey = (key: SortKey) => {
    setSortKey(key);
    setVisible(PAGE_SIZE);
    localStorage.setItem(SORT_KEY_STORAGE, key);
  };

  const action = (
    <div className="flex gap-1">
      <SortChip
        active={sortKey === 'recent'}
        onClick={() => handleSortKey('recent')}
        label="recent"
      />
      <SortChip
        active={sortKey === 'expensive'}
        onClick={() => handleSortKey('expensive')}
        label="expensive"
      />
    </div>
  );

  return (
    <StudioWidget label="turns" action={action}>
      {sorted.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.budget}
          title="No recorded turns yet"
          size="inline"
          className="justify-center py-4"
        />
      ) : (
        <div className="flex max-w-full flex-col gap-1">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">type</th>
                  <th className="px-2 py-2 font-medium">model</th>
                  {showSession ? <th className="px-2 py-2 font-medium">session</th> : null}
                  <th className="px-2 py-2 text-right font-medium">in</th>
                  <th className="px-2 py-2 text-right font-medium">out</th>
                  <th className="px-2 py-2 text-right font-medium">cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {shown.map(({ record, sessionGoal }) => (
                  <tr key={record.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-2xs font-medium uppercase',
                          record.kind === 'summarizer'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/15 text-primary',
                        )}
                      >
                        {record.kind}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <RoutingBadge provider={record.provider} model={record.model} />
                    </td>
                    {showSession ? (
                      <td
                        className="max-w-[12rem] truncate px-2 py-2 text-muted-foreground"
                        title={sessionGoal}
                      >
                        {sessionGoal}
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {formatTokens(record.inputTokens)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {formatTokens(record.outputTokens)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums font-medium text-foreground">
                      {formatUsdPrecise(record.estimatedCostUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="self-center rounded-md border border-border-soft px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Show more ({remaining})
            </button>
          )}
        </div>
      )}
    </StudioWidget>
  );
};

function SortChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-1.5 py-0.5 text-2xs uppercase tracking-[0.08em]',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}
