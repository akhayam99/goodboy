import { useMemo, useState } from 'react';
import { Chip, EmptyState, formatTokens, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ArrowUpRight } from 'lucide-react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { sortTurns, type SortKey, type WorkspaceTurn } from './lib';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { SortChip } from './SortChip';

type Props = {
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly showSession: boolean;
  readonly formatSpent?: (value: number) => string;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

type HandleSortKeyParams = {
  readonly key: SortKey;
};

const SORT_KEY_STORAGE = STORAGE_KEYS.pricingSortKey;
const PAGE_SIZE = 10;

export const TurnsTable = ({
  turns,
  showSession,
  formatSpent = formatUsd,
  onOpenSession,
}: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem(SORT_KEY_STORAGE);
    return stored === 'expensive' ? 'expensive' : 'recent';
  });
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sorted = useMemo(() => sortTurns(turns, sortKey), [turns, sortKey]);
  const shown = sorted.slice(0, visible);
  const remaining = sorted.length - shown.length;

  const handleSortKey = ({ key }: HandleSortKeyParams) => {
    setSortKey(key);
    setVisible(PAGE_SIZE);
    localStorage.setItem(SORT_KEY_STORAGE, key);
  };

  const action = (
    <div className="flex gap-1">
      <SortChip
        active={sortKey === 'recent'}
        onClick={() => handleSortKey({ key: 'recent' })}
        label="recent"
      />
      <SortChip
        active={sortKey === 'expensive'}
        onClick={() => handleSortKey({ key: 'expensive' })}
        label="expensive"
      />
    </div>
  );

  return (
    <StudioWidget label="turns" action={action}>
      {sorted.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.budget}
          tone={CONCEPT_TONE.budget}
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
                  <th className="w-5 px-2 py-2">
                    <span className="sr-only">Open session</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {shown.map(({ record, sessionId, sessionGoal }) => (
                  <tr key={record.id} className="group transition-colors hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <span>
                        <Chip
                          tone={record.kind === 'summarizer' ? 'neutral' : 'primary'}
                          size="xs"
                          shape="badge"
                          label={record.kind}
                          width="md"
                          className="uppercase"
                        />
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
                    <td
                      title={formatUsdPrecise(record.estimatedCostUsd)}
                      className="px-2 py-2 text-right font-mono tabular-nums font-medium text-foreground"
                    >
                      {formatSpent(record.estimatedCostUsd)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        aria-label={`Open session ${sessionGoal}`}
                        onClick={() => onOpenSession(sessionId)}
                        className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-hover:opacity-100"
                      >
                        <ArrowUpRight size={12} aria-hidden />
                      </button>
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
