import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { EmptyLine, ScrollFade, Skeleton } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { WINDOW_MIN_ROWS, layoutRows, windowOf } from '../../../../shared/utils/windowRows';
import type { ExploreEntry } from '../../../explore/explore';
import {
  EXPLORE_ROOT_PATH,
  entryRowsOf,
  flattenExploreRows,
  pendingFoldersOf,
  type ExploreEntryRow,
  type ExploreRow,
} from '../../../explore/exploreRows';
import { exploreTreeKey } from '../../../explore/exploreTreeKey';
import { useExploreListing } from '../../FilesMode/useExploreListing';
import { useRowWindow } from '../../hooks/useRowWindow';
import {
  ALL_FILES_ROW_PX,
  allFilesListingOf,
  folderSumsOf,
  searchRowsOf,
} from '../../lib/allFilesListing';
import type { ViewedState } from '../../lib/reviewedFiles';
import { AllFilesRow } from './AllFilesRow';
import { AllFilesStatusRow } from './AllFilesStatusRow';

type SetExpandedParams = {
  readonly path: string;
  readonly isExpanded: boolean;
};

type Props = {
  readonly sessionDir: string;
  readonly files: ReadonlyArray<FileDiff>;
  readonly query: string;
  readonly activePath: string | null;
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly onSetExpanded: (params: SetExpandedParams) => void;
  readonly stateOf: (file: FileDiff) => ViewedState;
  readonly onPickChanged: (path: string) => void;
  readonly onPickUnchanged: (entry: ExploreEntry) => void;
  readonly hasDelta: boolean;
};

const rowHeightOf = (): number => ALL_FILES_ROW_PX;

type IdParams = {
  readonly id: string;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLUListElement>;
};

type PickParams = {
  readonly row: ExploreEntryRow;
};

const domIdOf = ({ id }: IdParams): string => `all-files-row:${id}`;

export const AllFilesTree = ({
  sessionDir,
  files,
  query,
  activePath,
  expanded,
  onSetExpanded,
  stateOf,
  onPickChanged,
  onPickUnchanged,
  hasDelta,
}: Props) => {
  const { listing, load } = useExploreListing({ sessionDir });
  const merged = useMemo(() => allFilesListingOf({ files, listing }), [files, listing]);
  const byPath = useMemo(() => new Map(files.map((file) => [file.path, file] as const)), [files]);
  const sums = useMemo(() => folderSumsOf({ files }), [files]);
  const isSearching = query.trim() !== '';
  const rows = useMemo<ReadonlyArray<ExploreRow>>(
    () =>
      isSearching
        ? searchRowsOf({ files, listing: merged, query })
        : flattenExploreRows({ ...merged, expanded }),
    [expanded, files, isSearching, merged, query],
  );
  const entries = useMemo(() => entryRowsOf(rows), [rows]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [isTreeFocused, setIsTreeFocused] = useState(false);
  const layout = useMemo(() => layoutRows({ rows, heightOf: rowHeightOf }), [rows]);
  const isWindowed = rows.length > WINDOW_MIN_ROWS;
  const { scrollTop, viewport } = useRowWindow({ viewportRef, isWindowed });
  const { start, end } = isWindowed
    ? windowOf({ layout, count: rows.length, scrollTop, viewport })
    : { start: 0, end: rows.length };
  const shownRows = isWindowed ? rows.slice(start, end) : rows;
  const padTop = isWindowed ? (layout.offsets[start] ?? 0) : 0;
  const padBottom = isWindowed ? layout.total - (layout.offsets[end] ?? layout.total) : 0;
  const cursorRowId = entries.some((row) => row.id === cursorId) ? cursorId : null;

  useEffect(() => {
    if (isSearching) {
      return;
    }
    for (const relPath of pendingFoldersOf(rows)) {
      void load({ relPath });
    }
  }, [isSearching, load, rows]);

  const pick = useCallback(
    ({ row }: PickParams) => {
      setCursorId(row.id);
      const { entry } = row;
      if (entry.isDir) {
        onSetExpanded({ path: entry.relPath, isExpanded: !row.isExpanded });
        return;
      }
      if (byPath.has(entry.relPath)) {
        onPickChanged(entry.relPath);
        return;
      }
      onPickUnchanged(entry);
    },
    [byPath, onPickChanged, onPickUnchanged, onSetExpanded],
  );

  const handleKey = ({ event }: KeyParams) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const result = exploreTreeKey({ rows, activeId: cursorRowId, key: event.key });
    if (result.kind === 'none') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (result.kind === 'focus') {
      setCursorId(result.id);
      return;
    }
    if (result.kind === 'setExpanded') {
      onSetExpanded({ path: result.path, isExpanded: result.isExpanded });
      return;
    }
    const row = entries.find((candidate) => candidate.id === result.id);
    if (row !== undefined) {
      pick({ row });
    }
  };

  const rootEntries = merged.entriesByPath[EXPLORE_ROOT_PATH];
  const rootError = listing.errorByPath[EXPLORE_ROOT_PATH] ?? null;
  if (rootEntries === undefined && rootError === null) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2">
        <Skeleton className="h-4 w-full rounded-sm" />
        <Skeleton className="h-4 w-11/12 rounded-sm" />
        <Skeleton className="h-4 w-10/12 rounded-sm" />
      </div>
    );
  }
  return (
    <ScrollFade
      className="min-h-0 flex-1"
      fadeSize="h-6"
      viewportRef={viewportRef}
      isPageScroller={false}
    >
      {rootError === null ? null : (
        <div className="flex flex-col items-start gap-2 px-3 py-2 text-meta">
          <span className="text-danger">Couldn&apos;t read this folder</span>
          <EmptyLine>{rootError}</EmptyLine>
        </div>
      )}
      {isSearching && rows.length === 0 ? (
        <div className="px-3 py-2 text-meta text-muted-foreground">
          <EmptyLine>No files match.</EmptyLine>
        </div>
      ) : null}
      <ul
        role="tree"
        aria-label="All files"
        tabIndex={0}
        aria-activedescendant={cursorRowId === null ? undefined : domIdOf({ id: cursorRowId })}
        onKeyDown={(event) => handleKey({ event })}
        onFocus={() => {
          setIsTreeFocused(true);
          if (cursorRowId === null) {
            setCursorId(entries[0]?.id ?? null);
          }
        }}
        onBlur={() => setIsTreeFocused(false)}
        className="flex min-w-0 flex-col rounded-sm px-1 pb-4 focus-visible:outline-none"
        style={isWindowed ? { paddingTop: padTop, paddingBottom: padBottom + 16 } : undefined}
      >
        {shownRows.map((row) => {
          if (row.kind !== 'entry') {
            return <AllFilesStatusRow key={row.id} row={row} onRetry={load} />;
          }
          const sum = row.entry.isDir ? (sums.get(row.entry.relPath) ?? null) : null;
          const prefix = `${row.entry.relPath}/`;
          const viewedCount =
            sum === null
              ? 0
              : files.filter((file) => file.path.startsWith(prefix) && stateOf(file) === 'viewed')
                  .length;
          return (
            <AllFilesRow
              key={row.id}
              row={row}
              domId={domIdOf({ id: row.id })}
              file={byPath.get(row.entry.relPath) ?? null}
              folderSum={sum}
              viewedCount={viewedCount}
              isActive={!row.entry.isDir && row.entry.relPath === activePath}
              isCursor={row.id === cursorRowId}
              isTreeFocused={isTreeFocused}
              hasDelta={hasDelta}
              onPick={() => pick({ row })}
            />
          );
        })}
      </ul>
    </ScrollFade>
  );
};
