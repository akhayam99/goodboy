import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { EmptyLine, Button, ScrollFade, useEscapeLayer } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import {
  foldedAncestorOf,
  visibleRows,
  type ChangeTree as ChangeTreeModel,
  type TreeGroup,
} from '../../lib/changeTree';
import type { CommentKinds } from '../../lib/commentKinds';
import type { DiffFileActions } from '../DiffView/types';
import type { ViewedState } from '../../lib/reviewedFiles';
import { rowHeightOf } from '../../lib/rowHeightOf';
import {
  WINDOW_MIN_ROWS,
  layoutRows,
  scrollTopToReveal,
  windowOf,
} from '../../../../shared/utils/windowRows';
import { FileRow } from './FileRow';
import { FolderRow } from './FolderRow';
import { TreeHead } from './TreeHead';
import { TreeTitle } from './TreeTitle';
import { nameLengthOf } from './nameLengthOf';
import { treeKeyAction } from './treeKeys';

type TreeFilter = {
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly unviewedOnly: boolean;
  readonly onUnviewedOnly: (next: boolean) => void;
  readonly commentedOnly: boolean;
  readonly onCommentedOnly: (next: boolean) => void;
  readonly group: TreeGroup;
  readonly onGroup: (group: TreeGroup) => void;
  readonly isFiltering: boolean;
  readonly onClear: () => void;
};

type Props = {
  readonly tree: ChangeTreeModel;
  readonly allFiles: ReadonlyArray<FileDiff>;
  readonly total?: number;
  readonly filter: TreeFilter;
  readonly filterRef: RefObject<HTMLInputElement | null>;
  readonly activePath: string | null;
  readonly collapsed: ReadonlySet<string>;
  readonly onToggleFolder: (id: string) => void;
  readonly onPick: (path: string) => void;
  readonly stateOf: (file: FileDiff) => ViewedState;
  readonly commentCountOf: (path: string) => number;
  readonly kindsOf: (path: string) => CommentKinds;
  readonly isReadOnly: boolean;
  readonly onToggleViewed: (file: FileDiff) => void;
  readonly fileActions?: DiffFileActions | null;
  readonly onNextUnviewed: () => void;
  readonly onLeave: () => void;
  readonly onFold: () => void;
};

const DELTA_MIN_RAIL_PX = 300;

type RowIdParams = {
  readonly id: string;
};

const domIdOf = ({ id }: RowIdParams): string => `change-tree-row:${id}`;

export const ChangeTree = ({
  tree,
  allFiles,
  total = allFiles.length,
  filter,
  filterRef,
  activePath,
  collapsed,
  onToggleFolder,
  onPick,
  stateOf,
  commentCountOf,
  kindsOf,
  isReadOnly,
  onToggleViewed,
  fileActions = null,
  onNextUnviewed,
  onLeave,
  onFold,
}: Props) => {
  const rows = useMemo(() => visibleRows({ rows: tree.rows, collapsed }), [tree.rows, collapsed]);
  const markedId = useMemo(
    () =>
      activePath === null
        ? null
        : foldedAncestorOf({ rows: tree.rows, collapsed, path: activePath }),
    [activePath, collapsed, tree.rows],
  );
  const trackedId = markedId ?? activePath;
  const states = useMemo(
    () => new Map(allFiles.map((file) => [file.path, stateOf(file)] as const)),
    [allFiles, stateOf],
  );
  const viewedCount = useMemo(
    () => [...states.values()].filter((state) => state === 'viewed').length,
    [states],
  );
  const unviewedCount = allFiles.length - viewedCount;
  const commentedCount = useMemo(
    () => allFiles.filter((file) => commentCountOf(file.path) > 0).length,
    [allFiles, commentCountOf],
  );
  const stage = useElementWidth();
  const railWidth = stage.width ?? 0;
  const hasDelta = railWidth >= DELTA_MIN_RAIL_PX;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [isTreeFocused, setIsTreeFocused] = useState(false);
  useEscapeLayer(onLeave, isTreeFocused);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const layout = useMemo(() => layoutRows({ rows, heightOf: rowHeightOf }), [rows]);
  const isWindowed = rows.length > WINDOW_MIN_ROWS;
  const { start, end } = isWindowed
    ? windowOf({ layout, count: rows.length, scrollTop, viewport })
    : { start: 0, end: rows.length };
  const shownRows = isWindowed ? rows.slice(start, end) : rows;
  const padTop = isWindowed ? (layout.offsets[start] ?? 0) : 0;
  const padBottom = isWindowed ? layout.total - (layout.offsets[end] ?? layout.total) : 0;
  const cursorRowId =
    cursorId !== null && rows.some((row) => row.id === cursorId) ? cursorId : null;

  const startCursorId =
    trackedId !== null && rows.some((row) => row.id === trackedId)
      ? trackedId
      : (rows[0]?.id ?? null);

  useEffect(() => {
    const element = viewportRef.current;
    if (element === null || !isWindowed) {
      return;
    }
    const measure = () => {
      setScrollTop(element.scrollTop);
      setViewport(element.clientHeight);
    };
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [isWindowed]);

  const reveal = useCallback(
    (id: string) => {
      const element = viewportRef.current;
      if (!isWindowed || element === null) {
        document.getElementById(domIdOf({ id }))?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      const index = rows.findIndex((row) => row.id === id);
      const row = rows[index];
      if (row === undefined) {
        return;
      }
      const next = scrollTopToReveal({
        layout,
        index,
        rowPx: rowHeightOf(row),
        scrollTop: element.scrollTop,
        viewport: element.clientHeight,
      });
      if (next !== element.scrollTop) {
        element.scrollTop = next;
      }
    },
    [isWindowed, layout, rows],
  );

  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const trackedRef = useRef(trackedId);
  trackedRef.current = trackedId;

  useEffect(() => {
    const target = trackedRef.current;
    if (activePath === null || target === null) {
      return;
    }
    revealRef.current(target);
  }, [activePath]);

  const moveCursor = useCallback(
    (id: string) => {
      setCursorId(id);
      reveal(id);
    },
    [reveal],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const action = treeKeyAction({
      key: event.key,
      rows,
      cursorId: cursorRowId,
      collapsed,
    });
    if (action === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    switch (action.kind) {
      case 'cursor':
        moveCursor(action.id);
        return;
      case 'fold':
        onToggleFolder(action.id);
        return;
      case 'pick':
        onPick(action.id);
        return;
      case 'viewed': {
        const file = allFiles.find((candidate) => candidate.path === action.id);
        if (file !== undefined && !isReadOnly) {
          onToggleViewed(file);
        }
        return;
      }
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  };

  return (
    <nav
      ref={stage.ref}
      aria-label="Changed files"
      className="flex min-h-0 w-full min-w-0 flex-col"
    >
      <TreeTitle viewedCount={viewedCount} total={total} onNext={onNextUnviewed} onFold={onFold} />
      <TreeHead
        total={total}
        unviewed={unviewedCount}
        commented={commentedCount}
        query={filter.query}
        onQuery={filter.onQuery}
        filterRef={filterRef}
        unviewedOnly={filter.unviewedOnly}
        onUnviewedOnly={filter.onUnviewedOnly}
        commentedOnly={filter.commentedOnly}
        onCommentedOnly={filter.onCommentedOnly}
        group={filter.group}
        onGroup={filter.onGroup}
        shown={tree.files.length}
        isFiltering={filter.isFiltering}
        onClear={filter.onClear}
      />
      <ScrollFade
        className="min-h-0 flex-1"
        fadeSize="h-6"
        viewportRef={viewportRef}
        isPageScroller={false}
      >
        {rows.length === 0 && filter.isFiltering ? (
          <div className="flex flex-col items-start gap-2 px-3 py-2 text-meta text-muted-foreground">
            <EmptyLine>No files match.</EmptyLine>
            <Button size="sm" variant="ghost" onClick={filter.onClear}>
              Clear
            </Button>
          </div>
        ) : null}
        <ul
          role="tree"
          aria-label="Changed files"
          tabIndex={0}
          aria-activedescendant={cursorRowId === null ? undefined : domIdOf({ id: cursorRowId })}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setIsTreeFocused(true);
            if (cursorRowId === null) {
              setCursorId(startCursorId);
            }
          }}
          onBlur={() => setIsTreeFocused(false)}
          className="flex min-w-0 flex-col rounded-sm px-1 pb-4 focus-visible:outline-none"
          style={isWindowed ? { paddingTop: padTop, paddingBottom: padBottom + 16 } : undefined}
        >
          {shownRows.map((row) => {
            const domId = domIdOf({ id: row.id });
            const isCursor = row.id === cursorRowId;
            if (row.kind === 'folder') {
              return (
                <FolderRow
                  key={row.id}
                  row={row}
                  domId={domId}
                  isOpen={!collapsed.has(row.id)}
                  isMarked={row.id === markedId}
                  isCursor={isCursor}
                  isTreeFocused={isTreeFocused}
                  viewedCount={row.paths.filter((path) => states.get(path) === 'viewed').length}
                  hasDelta={hasDelta}
                  onToggle={() => {
                    setCursorId(row.id);
                    onToggleFolder(row.id);
                  }}
                />
              );
            }
            const kinds = kindsOf(row.id);
            return (
              <FileRow
                key={row.id}
                row={row}
                domId={domId}
                isActive={row.id === activePath}
                isCursor={isCursor}
                isTreeFocused={isTreeFocused}
                state={states.get(row.id) ?? 'none'}
                kinds={kinds}
                nameLength={nameLengthOf({
                  depth: row.depth,
                  count: kinds.notes + kinds.host,
                  railWidth,
                  hasDelta,
                })}
                hasDelta={hasDelta}
                fileActions={fileActions}
                onPick={() => {
                  setCursorId(row.id);
                  onPick(row.id);
                }}
              />
            );
          })}
        </ul>
      </ScrollFade>
    </nav>
  );
};
