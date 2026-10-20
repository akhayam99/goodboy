import { useMemo, useState } from 'react';
import {
  Button,
  Chip,
  formatTokens,
  formatUsd,
  formatUsdPrecise,
  SegmentedTabs,
  STRIPED_MIN_ROWS,
  STRIPED_ROW,
  STRIPED_TABLE,
  Tooltip,
  TruncatedText,
  cn,
  type SegmentedTabOption,
  EmptyState,
  IconButton,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ArrowUpRight } from 'lucide-react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';
import { DeletedSessionTag } from '../../../../shared/components/DeletedSessionTag';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { StudioWidget } from '@goodboy/ui';
import { sortTurns, type SortKey, type WorkspaceTurn } from './lib';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly showSession: boolean;
  readonly formatSpent?: (value: number) => string;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

type HandleSortKeyParams = {
  readonly key: SortKey;
};

const sortKeyPref = persistedPref<SortKey>({
  key: STORAGE_KEYS.pricingSortKey,
  parse: (raw) => (raw === 'expensive' ? 'expensive' : 'recent'),
  serialize: (key) => key,
  fallback: 'recent',
});
const SORT_OPTIONS: ReadonlyArray<SegmentedTabOption<SortKey>> = [
  { value: 'recent', label: 'Recent' },
  { value: 'expensive', label: 'Most expensive' },
];
const PAGE_SIZE = 10;

export const TurnsTable = ({
  turns,
  showSession,
  formatSpent = formatUsd,
  onOpenSession,
}: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>(sortKeyPref.read);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sorted = useMemo(() => sortTurns(turns, sortKey), [turns, sortKey]);
  const shown = sorted.slice(0, visible);
  const remaining = sorted.length - shown.length;

  const handleSortKey = ({ key }: HandleSortKeyParams) => {
    setSortKey(key);
    setVisible(PAGE_SIZE);
    sortKeyPref.write(key);
  };

  const action = (
    <SegmentedTabs
      ariaLabel="Sort turns"
      size="sm"
      value={sortKey}
      onChange={(key) => handleSortKey({ key })}
      options={SORT_OPTIONS}
    />
  );

  return (
    <StudioWidget label="Turns" action={action}>
      {sorted.length === 0 ? (
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.budget}
          tone={CONCEPT_TONE.budget}
          title="No recorded turns yet"
          className="justify-center"
        />
      ) : (
        <div className="flex max-w-full flex-col gap-1">
          <div className="max-w-full overflow-x-auto">
            <table className={cn('w-full min-w-[36rem] text-left text-label', STRIPED_TABLE)}>
              <thead className="text-eyebrow text-faint-foreground">
                <tr>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Model</th>
                  {showSession ? <th className="px-2 py-2">Session</th> : null}
                  <th className="px-2 py-2 text-right">In</th>
                  <th className="px-2 py-2 text-right">Out</th>
                  <th className="px-2 py-2 text-right">Cost</th>
                  <th className="w-5 px-2 py-2">
                    <span className="sr-only">Open session</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ record, sessionId, sessionGoal, isSessionDeleted }) => (
                  <tr
                    key={record.id}
                    className={cn(
                      'group hover:[&>*]:bg-hover',
                      shown.length >= STRIPED_MIN_ROWS && STRIPED_ROW,
                    )}
                  >
                    <td className="px-2 py-2">
                      <span>
                        <Chip
                          tone={record.kind === 'turn' ? 'primary' : 'neutral'}
                          size="xs"
                          shape="badge"
                          label={record.kind}
                          width="md"
                          className="uppercase"
                        />
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <RoutingLabel provider={record.provider} model={record.model} />
                    </td>
                    {showSession ? (
                      <td className="max-w-[12rem] truncate px-2 py-2 text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <TruncatedText className="min-w-0">{sessionGoal}</TruncatedText>
                          {isSessionDeleted ? <DeletedSessionTag /> : null}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {formatTokens(record.inputTokens)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {formatTokens(record.outputTokens)}
                    </td>
                    <Tooltip content={formatUsdPrecise(record.estimatedCostUsd)}>
                      <td className="px-2 py-2 text-right tabular-nums font-medium text-foreground">
                        {formatSpent(record.estimatedCostUsd)}
                      </td>
                    </Tooltip>
                    <td className="px-2 py-2">
                      {isSessionDeleted ? null : (
                        <IconButton
                          icon={ArrowUpRight}
                          label={`Open session ${sessionGoal}`}
                          size="xs"
                          onClick={() => onOpenSession(sessionId)}
                          className="size-5"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {remaining > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="self-center"
            >
              Show more ({remaining})
            </Button>
          )}
        </div>
      )}
    </StudioWidget>
  );
};
