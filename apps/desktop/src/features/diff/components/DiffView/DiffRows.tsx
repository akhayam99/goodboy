import { Fragment, useMemo, type ReactNode } from 'react';
import { cn, type DiffLayoutMode } from '@goodboy/ui';
import type { DiffCommentSide, DiffHunkLine, FileDiff } from '@goodboy/types';
import { buildDiffRows, type DiffRow } from '../../../../shared/utils/diffRows';
import { buildDiffPairRows, type DiffPairRow } from '../../../../shared/utils/diffPairRows';
import { pairDiffLines } from '../../../../shared/utils/diffLinePairs';
import { visibleDiffRows } from '../../../../shared/utils/visibleDiffRows';
import { tokensForLine, type DiffTokenMap } from '../../hooks/useDiffTokens';
import { LINE_PREFIX } from '../../lib/fileStatus';
import {
  EMPTY_SIDE_FILL,
  LINE_FILL,
  SELECTED_FILL,
  SELECTED_RAIL,
  SIGN_TEXT,
  WORD_FILL,
} from '../../lib/lineTone';
import { changedRanges, type CharRange } from '../../lib/wordDiff';
import { SyntaxText } from '../SyntaxText';
import { HunkHeader } from './HunkHeader';
import { LineGutter } from './LineGutter';

export type LineSpot = {
  readonly side: DiffCommentSide;
  readonly line: number;
};

export type LineSelection = {
  readonly side: DiffCommentSide;
  readonly lo: number;
  readonly hi: number;
};

type Props = {
  readonly file: FileDiff;
  readonly layout: DiffLayoutMode;
  readonly wrap: boolean;
  readonly tokens: DiffTokenMap | null;
  readonly visibleLines: number;
  readonly canComment: boolean;
  readonly selection: LineSelection | null;
  readonly isRangeCommented: (side: DiffCommentSide, line: number) => boolean;
  readonly blocksAfter: (spot: LineSpot) => ReactNode;
  readonly onPress: (side: DiffCommentSide, line: number, extend: boolean) => void;
  readonly onHover: (side: DiffCommentSide, line: number) => void;
  readonly onActivate: (side: DiffCommentSide, line: number) => void;
};

const UNIFIED_COLUMNS = 'grid-cols-[48px_48px_16px_minmax(0,1fr)]';
const SPLIT_COLUMNS = 'grid-cols-[44px_minmax(0,1fr)_44px_minmax(0,1fr)]';

const codeClass = (wrap: boolean): string =>
  cn(
    'min-w-0 pr-3 font-mono text-xs leading-5 text-foreground [tab-size:4]',
    wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre',
  );

const oldSpot = (line: DiffHunkLine | null): number | null =>
  line !== null && line.kind !== 'add' ? line.oldLine : null;

const newSpot = (line: DiffHunkLine | null): number | null =>
  line !== null && line.kind !== 'del' ? line.newLine : null;

const buildWordMarks = (file: FileDiff): ReadonlyMap<DiffHunkLine, CharRange> => {
  const marks = new Map<DiffHunkLine, CharRange>();
  for (const hunk of file.hunks) {
    for (const pair of pairDiffLines({ lines: hunk.lines })) {
      if (pair.old?.kind !== 'del' || pair.new?.kind !== 'add') {
        continue;
      }
      const ranges = changedRanges(pair.old.text, pair.new.text);
      if (ranges === null) {
        continue;
      }
      marks.set(pair.old, ranges.old);
      marks.set(pair.new, ranges.new);
    }
  }
  return marks;
};

export const DiffRows = ({
  file,
  layout,
  wrap,
  tokens,
  visibleLines,
  canComment,
  selection,
  isRangeCommented,
  blocksAfter,
  onPress,
  onHover,
  onActivate,
}: Props) => {
  const isSplit = layout === 'split';
  const effectiveWrap = isSplit || wrap;
  const rows = useMemo<ReadonlyArray<DiffRow | DiffPairRow>>(
    () =>
      isSplit
        ? visibleDiffRows({ rows: buildDiffPairRows({ hunks: file.hunks }), visibleLines })
        : visibleDiffRows({ rows: buildDiffRows({ hunks: file.hunks }), visibleLines }),
    [file.hunks, isSplit, visibleLines],
  );
  const marks = useMemo(() => buildWordMarks(file), [file]);

  const isSelected = (side: DiffCommentSide, line: number | null): boolean =>
    line !== null &&
    selection !== null &&
    selection.side === side &&
    line >= selection.lo &&
    line <= selection.hi;

  const gutter = (
    side: DiffCommentSide,
    line: number | null,
    showPlus: boolean,
    className?: string,
  ) => (
    <LineGutter
      className={className}
      side={side}
      lineNumber={line}
      canComment={canComment}
      showPlus={showPlus}
      isSelected={isSelected(side, line)}
      onPress={onPress}
      onHover={onHover}
      onActivate={onActivate}
    />
  );

  const text = (line: DiffHunkLine) => (
    <SyntaxText
      text={line.text}
      tokens={tokensForLine(tokens, line)}
      mark={marks.get(line) ?? null}
      markClassName={WORD_FILL[line.kind]}
    />
  );

  let rowIndex = 1;
  const nextIndex = () => {
    rowIndex += 1;
    return rowIndex;
  };

  const blockRow = (key: string, node: ReactNode, side: DiffCommentSide | null) => {
    if (node === null || node === false || node === undefined) {
      return null;
    }
    return (
      <div
        key={key}
        role="row"
        aria-rowindex={nextIndex()}
        className={cn('grid py-1.5', isSplit ? SPLIT_COLUMNS : UNIFIED_COLUMNS)}
      >
        <div
          role="gridcell"
          className={cn(
            'min-w-0 pr-3',
            isSplit ? (side === 'old' ? 'col-start-2' : 'col-start-4') : 'col-start-4',
          )}
        >
          {node}
        </div>
      </div>
    );
  };

  return (
    <div
      role="grid"
      aria-label={`Changes in ${file.path}`}
      className={cn('flex flex-col', !effectiveWrap && 'w-max min-w-full')}
    >
      {rows.map((row) => {
        if (row.type === 'header') {
          return <HunkHeader key={`h${row.hunkIndex}`} label={row.header} rowIndex={nextIndex()} />;
        }
        if (row.type === 'line') {
          const { line } = row;
          const oldLine = oldSpot(line);
          const newLine = newSpot(line);
          const selected = isSelected('old', oldLine) || isSelected('new', newLine);
          const commented =
            (oldLine !== null && isRangeCommented('old', oldLine)) ||
            (newLine !== null && isRangeCommented('new', newLine));
          const oldBlocks = oldLine === null ? null : blocksAfter({ side: 'old', line: oldLine });
          const newBlocks = newLine === null ? null : blocksAfter({ side: 'new', line: newLine });
          return (
            <Fragment key={`l${row.hunkIndex}-${row.rowIndex}`}>
              <div
                role="row"
                aria-rowindex={nextIndex()}
                data-line-kind={line.kind}
                className={cn(
                  'group/line grid',
                  UNIFIED_COLUMNS,
                  LINE_FILL[line.kind],
                  selected && SELECTED_FILL,
                  (selected || commented) && SELECTED_RAIL,
                )}
              >
                {gutter('old', oldLine, line.kind === 'del')}
                {gutter('new', newLine, true)}
                <div
                  role="gridcell"
                  aria-hidden
                  className={cn(
                    'select-none text-center font-mono text-xs leading-5',
                    SIGN_TEXT[line.kind],
                  )}
                >
                  {LINE_PREFIX[line.kind]}
                </div>
                <div role="gridcell" className={codeClass(effectiveWrap)}>
                  {text(line)}
                </div>
              </div>
              {blockRow(`o${row.hunkIndex}-${row.rowIndex}`, oldBlocks, 'old')}
              {blockRow(`n${row.hunkIndex}-${row.rowIndex}`, newBlocks, 'new')}
            </Fragment>
          );
        }
        const { pair } = row;
        const oldLine = oldSpot(pair.old);
        const newLine = newSpot(pair.new);
        const oldBlocks = oldLine === null ? null : blocksAfter({ side: 'old', line: oldLine });
        const newBlocks = newLine === null ? null : blocksAfter({ side: 'new', line: newLine });
        const sideCells = (
          side: DiffCommentSide,
          line: DiffHunkLine | null,
          spot: number | null,
        ) => {
          const fill = line === null ? EMPTY_SIDE_FILL : LINE_FILL[line.kind];
          const selected = isSelected(side, spot);
          const commented = spot !== null && isRangeCommented(side, spot);
          return (
            <>
              {gutter(
                side,
                spot,
                true,
                cn(fill, selected && SELECTED_FILL, (selected || commented) && SELECTED_RAIL),
              )}
              <div
                role="gridcell"
                className={cn(codeClass(true), 'flex', fill, selected && SELECTED_FILL)}
              >
                {line === null ? null : (
                  <>
                    <span
                      aria-hidden
                      className={cn('w-4 shrink-0 select-none text-center', SIGN_TEXT[line.kind])}
                    >
                      {LINE_PREFIX[line.kind]}
                    </span>
                    <span className="min-w-0 flex-1">{text(line)}</span>
                  </>
                )}
              </div>
            </>
          );
        };
        return (
          <Fragment key={`p${row.hunkIndex}-${row.rowIndex}`}>
            <div
              role="row"
              aria-rowindex={nextIndex()}
              className={cn('group/line grid', SPLIT_COLUMNS)}
            >
              {sideCells('old', pair.old, oldLine)}
              {sideCells('new', pair.new, newLine)}
            </div>
            {blockRow(`po${row.hunkIndex}-${row.rowIndex}`, oldBlocks, 'old')}
            {blockRow(`pn${row.hunkIndex}-${row.rowIndex}`, newBlocks, 'new')}
          </Fragment>
        );
      })}
    </div>
  );
};
