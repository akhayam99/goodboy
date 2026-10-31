import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ICON_SIZE,
  ListGrid,
  ROW_INTERACTIVE,
  SectionLabel,
  cn,
  type ListGridColumn,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BranchRow } from '../BranchRow';
import { SeriesStrip } from '../SeriesStrip';
import { useElementWidth } from '../../../../../shared/hooks/useElementWidth';
import { useSeriesStrips } from '../../../../../shared/hooks/useSeriesStrips';
import { branchFoldOf, type BranchEntry } from '../branchStoryOf';

type Props = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<BranchEntry>;
};

const BRANCH_COLUMN: ListGridColumn = {
  key: 'branch',
  width: 232,
  isTitle: true,
  isShrinkable: true,
};

const PROJECT_COLUMN: ListGridColumn = { key: 'project', width: 112, isShrinkable: true };

const ROW_COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'request', width: 48, isNumeric: true, tone: 'hint' },
  { key: 'track', width: 80 },
  { key: 'state', width: 124, isShrinkable: true },
  { key: 'detail', width: 'fill' },
  { key: 'open', width: 16, align: 'end' },
];

const SINGLE_PROJECT_COLUMNS: ReadonlyArray<ListGridColumn> = [BRANCH_COLUMN, ...ROW_COLUMNS];

const MULTI_PROJECT_COLUMNS: ReadonlyArray<ListGridColumn> = [
  BRANCH_COLUMN,
  PROJECT_COLUMN,
  ...ROW_COLUMNS,
];

const NARROW_COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'branch', width: 'fill', isTitle: true },
  { key: 'open', width: 16, align: 'end' },
];

const NARROW_BELOW_PX = 640;

type ColumnsParams = {
  readonly isNarrow: boolean;
  readonly isProjectShown: boolean;
};

const columnsOf = ({ isNarrow, isProjectShown }: ColumnsParams): ReadonlyArray<ListGridColumn> => {
  if (isNarrow) {
    return NARROW_COLUMNS;
  }
  return isProjectShown ? MULTI_PROJECT_COLUMNS : SINGLE_PROJECT_COLUMNS;
};

export const BranchList = ({ sessionId, entries }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { ref, width } = useElementWidth();
  const isNarrow = width !== null && width < NARROW_BELOW_PX;
  const fold = branchFoldOf({ entries });
  const strips = useSeriesStrips({ sessionId });
  const rows = isOpen ? entries : fold.shown;
  const isProjectShown = new Set(entries.map((entry) => entry.fact.projectName)).size >= 2;
  return (
    <section ref={ref} aria-label="Branches" className="flex min-w-0 flex-col gap-2">
      {entries.length >= 2 ? (
        <SectionLabel label="Branches" count={entries.length} headingLevel={2} />
      ) : null}
      {strips.map((strip) => (
        <SeriesStrip key={strip.id} strip={strip} />
      ))}
      <ListGrid label="Branches" columns={columnsOf({ isNarrow, isProjectShown })}>
        {rows.map((entry) => (
          <BranchRow
            key={entry.fact.mountId}
            sessionId={sessionId}
            entry={entry}
            isProjectShown={isProjectShown}
            isNarrow={isNarrow}
          />
        ))}
      </ListGrid>
      {fold.label === null ? null : (
        <button
          type="button"
          aria-expanded={isOpen}
          data-branch-fold=""
          onClick={() => setIsOpen((wasOpen) => !wasOpen)}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left text-ui text-muted-foreground',
            ROW_INTERACTIVE,
          )}
        >
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className={cn('shrink-0', isOpen ? 'rotate-180' : null)}
          />
          <span className="truncate">{isOpen ? 'Show fewer branches' : fold.label}</span>
        </button>
      )}
    </section>
  );
};
