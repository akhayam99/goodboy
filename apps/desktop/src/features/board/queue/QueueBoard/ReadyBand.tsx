import { InteractiveRow, SectionLabel, TruncatedText } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { ReadyRow } from '../readyToMergeOf';

type RowParams = {
  readonly row: ReadyRow;
};

type Props = {
  readonly rows: ReadonlyArray<ReadyRow>;
  readonly sessionTitles: ReadonlyMap<string, string>;
  readonly focusedId: string | null;
  readonly isActive: boolean;
  readonly onOpen: (params: RowParams) => void;
};

export const ReadyBand = ({ rows, sessionTitles, focusedId, isActive, onOpen }: Props) => (
  <section
    aria-label={NAMES.readyToMerge}
    data-queue-band="ready"
    data-band-active={isActive ? '' : undefined}
    tabIndex={-1}
    className="flex min-w-0 flex-col gap-2 outline-none"
  >
    <SectionLabel label={NAMES.readyToMerge} headingLevel={2} />
    {rows.length === 0 ? (
      <span className="text-ui text-muted-foreground">{NAMES.nothingToMerge}</span>
    ) : null}
    {rows.map((row) => {
      const title = sessionTitles.get(row.sessionId) ?? '';
      return (
        <InteractiveRow
          key={row.sessionId}
          label={title}
          isSelected={isActive && row.sessionId === focusedId}
          onOpen={() => onOpen({ row })}
          dataAttributes={{ 'data-ready-row': row.sessionId }}
          className="flex min-h-8 min-w-0 items-center gap-3 px-3"
        >
          <TruncatedText className="min-w-0 flex-1 text-ui text-foreground">{title}</TruncatedText>
          {row.number === null ? null : (
            <span className="shrink-0 text-meta tabular-nums text-muted-foreground">{`#${row.number}`}</span>
          )}
        </InteractiveRow>
      );
    })}
  </section>
);
