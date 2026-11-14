import { ChevronRight, Folder } from 'lucide-react';
import type { FileDiff } from '@goodboy/types';
import { cn, ICON_SIZE, SelectableRow, tintClasses, treeIndentPx } from '@goodboy/ui';
import { MiddleText } from '../../../../shared/components/MiddleText';
import type { ExploreEntryRow } from '../../../explore/exploreRows';
import { fileGlyphOf } from '../../../explore/fileGlyph';
import { ALL_FILES_ROW_PX } from '../../lib/allFilesListing';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD } from '../../lib/fileStatus';
import { ViewedRing } from '../ViewedRing';
import { Delta } from './Delta';

type FolderSum = {
  readonly additions: number;
  readonly deletions: number;
  readonly count: number;
};

type Props = {
  readonly row: ExploreEntryRow;
  readonly domId: string;
  readonly file: FileDiff | null;
  readonly folderSum: FolderSum | null;
  readonly viewedCount: number;
  readonly isActive: boolean;
  readonly isCursor: boolean;
  readonly isTreeFocused: boolean;
  readonly hasDelta: boolean;
  readonly onPick: () => void;
};

const EXTENSION = /\.[^./]*$/;
const BUTTON = 'items-center pr-2 text-body';

export const AllFilesRow = ({
  row,
  domId,
  file,
  folderSum,
  viewedCount,
  isActive,
  isCursor,
  isTreeFocused,
  hasDelta,
  onPick,
}: Props) => {
  const { entry } = row;
  const frame = cn(
    'relative list-none rounded-sm',
    isCursor && isTreeFocused && 'ring-2 ring-inset ring-focus-ring',
  );
  const lane = { paddingLeft: treeIndentPx({ depth: row.depth }), height: ALL_FILES_ROW_PX };
  if (entry.isDir) {
    const hasChanges = folderSum !== null;
    return (
      <li
        id={domId}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-expanded={row.isExpanded}
        aria-selected={isCursor}
        data-tree-row={row.id}
        className={frame}
      >
        <SelectableRow
          selected={false}
          onClick={onPick}
          tabIndex={-1}
          className={cn(BUTTON, 'text-row', hasChanges && 'text-foreground')}
        >
          <span style={lane} className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronRight
              size={ICON_SIZE.row}
              aria-hidden
              className={cn(
                'shrink-0 text-muted-foreground duration-150 motion-safe:transition-transform',
                row.isExpanded && 'rotate-90',
              )}
            />
            {hasChanges ? (
              <ViewedRing viewed={viewedCount} total={folderSum.count} />
            ) : (
              <Folder size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
            )}
            <span className="block min-w-0 flex-1 truncate">{entry.name}</span>
            {row.isExpanded || !hasChanges || !hasDelta ? null : (
              <>
                <Delta additions={folderSum.additions} deletions={folderSum.deletions} isMuted />
                <span aria-hidden className="w-3 shrink-0" />
              </>
            )}
          </span>
        </SelectableRow>
      </li>
    );
  }
  const Glyph = fileGlyphOf({ name: entry.name });
  const isDeleted = file?.status === 'deleted';
  const tone = file === null ? null : tintClasses(STATUS_TONE[file.status]);
  return (
    <li
      id={domId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isCursor}
      aria-current={isActive ? 'true' : undefined}
      data-tree-row={row.id}
      data-changed={file === null ? 'false' : 'true'}
      className={frame}
    >
      <SelectableRow
        selected={isActive}
        onClick={onPick}
        tabIndex={-1}
        className={cn(BUTTON, file !== null && 'text-foreground')}
      >
        <span style={lane} className="flex min-w-0 flex-1 items-center gap-2">
          <Glyph size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              isDeleted && 'text-faint-foreground line-through',
            )}
          >
            <MiddleText value={entry.name} tail={EXTENSION} />
          </span>
          {file === null || !hasDelta ? null : (
            <Delta additions={file.additions} deletions={file.deletions} />
          )}
          {file === null || tone === null ? null : (
            <span
              aria-label={STATUS_WORD[file.status]}
              className={cn('w-3 shrink-0 text-center text-chip', tone.text)}
            >
              {file.status === 'modified' ? '' : STATUS_LETTER[file.status]}
            </span>
          )}
        </span>
      </SelectableRow>
    </li>
  );
};
