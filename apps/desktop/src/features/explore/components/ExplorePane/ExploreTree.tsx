import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ExploreFileActionTarget } from '../../../actions/types';
import { runObjectAction } from '../../../actions/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useHeldPaletteScope } from '../../../palette/useHeldPaletteScope';
import {
  WINDOW_MIN_ROWS,
  layoutRows,
  scrollTopToReveal,
  windowOf,
} from '../../../../shared/utils/windowRows';
import { exploreFileTargetOf } from '../../exploreFileTarget';
import type {
  FailureParams,
  FocusRowParams,
  LoadFolderParams,
  OpenEntryParams,
  RunRowActionParams,
  SelectFileParams,
  SetExpandedParams,
} from '../../exploreHandlers';
import {
  EXPLORE_ROW_PX,
  entryRowsOf,
  exploreRowHeight,
  flattenExploreRows,
  pendingFoldersOf,
  type ExploreEntryRow,
  type ExploreListing,
} from '../../exploreRows';
import { exploreTreeKey } from '../../exploreTreeKey';
import { useExploreOpen } from '../../hooks/useExploreOpen';
import type { ExploreOpenFailure } from '../../openFailure';
import { ExploreRow } from './ExploreRow';
import { ExploreStatusRow } from './ExploreStatusRow';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string;
  readonly listing: ExploreListing;
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly selectedRelPath: string | null;
  readonly now: number;
  readonly onSetExpanded: (params: SetExpandedParams) => void;
  readonly onLoad: (params: LoadFolderParams) => void;
  readonly onSelectFile: (params: SelectFileParams) => void;
};

export const ExploreTree = ({
  sessionId,
  sessionDir,
  listing,
  expanded,
  selectedRelPath,
  now,
  onSetExpanded,
  onLoad,
  onSelectFile,
}: Props) => {
  const exploreOpen = useExploreOpen({ sessionId, sessionDir });
  const env = useActionEnv({ origin: 'button' });
  const [failureByPath, setFailureByPath] = useState<
    Readonly<Record<string, ExploreOpenFailure | null>>
  >({});
  const [askPath, setAskPath] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const rows = useMemo(
    () => flattenExploreRows({ ...listing, expanded, failureByPath }),
    [listing, expanded, failureByPath],
  );
  const entries = useMemo(() => entryRowsOf(rows), [rows]);
  const layout = useMemo(() => layoutRows({ rows, heightOf: exploreRowHeight }), [rows]);
  const isWindowed = rows.length > WINDOW_MIN_ROWS;
  const { start, end } = isWindowed
    ? windowOf({ layout, count: rows.length, scrollTop, viewport })
    : { start: 0, end: rows.length };
  const shownRows = isWindowed ? rows.slice(start, end) : rows;
  const padTop = isWindowed ? (layout.offsets[start] ?? 0) : 0;
  const padBottom = isWindowed ? layout.total - (layout.offsets[end] ?? layout.total) : 0;

  const effectiveActiveId = useMemo(() => {
    if (entries.some((row) => row.id === activeId)) {
      return activeId;
    }
    return entries.find((row) => row.id === selectedRelPath)?.id ?? entries[0]?.id ?? null;
  }, [activeId, entries, selectedRelPath]);
  const isActiveRendered = shownRows.some((row) => row.id === effectiveActiveId);

  useEffect(() => {
    for (const relPath of pendingFoldersOf(rows)) {
      onLoad({ relPath });
    }
  }, [rows, onLoad]);

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

  const setFailure = useCallback(
    ({ relPath, failure }: FailureParams) =>
      setFailureByPath((previous) => ({ ...previous, [relPath]: failure })),
    [],
  );

  const runOpen = useCallback(
    async ({ entry, isReveal }: OpenEntryParams) => {
      const failure = await exploreOpen.run({ entry, isReveal });
      setFailure({ relPath: entry.relPath, failure });
    },
    [exploreOpen, setFailure],
  );

  const targetOf = (row: ExploreEntryRow): ExploreFileActionTarget => {
    const { entry } = row;
    return exploreFileTargetOf({
      sessionId,
      sessionDir,
      entry,
      openAction: exploreOpen.canOpen({ entry }) ? exploreOpen.actionOf({ entry }) : null,
      onAsk: () => setAskPath(entry.relPath),
      onOpen: () => void runOpen({ entry, isReveal: false }),
      onReveal: () => void runOpen({ entry, isReveal: true }),
    });
  };

  const activeRow = entries.find((row) => row.id === effectiveActiveId);
  const treeRef = useHeldPaletteScope<HTMLDivElement>({
    scope: activeRow === undefined ? null : targetOf(activeRow),
  });

  const handleRun = useCallback(
    ({ target, actionId }: RunRowActionParams) => void runObjectAction({ target, actionId, env }),
    [env],
  );

  const handleAskClosed = useCallback(() => setAskPath(null), []);

  const focusRow = useCallback(
    ({ id }: FocusRowParams) => {
      setActiveId(id);
      pendingFocus.current = id;
      const element = viewportRef.current;
      const index = rows.findIndex((row) => row.id === id);
      if (element === null || index < 0) {
        return;
      }
      const next = scrollTopToReveal({
        layout,
        index,
        rowPx: EXPLORE_ROW_PX,
        scrollTop: element.scrollTop,
        viewport: element.clientHeight,
      });
      if (next !== element.scrollTop) {
        element.scrollTop = next;
      }
    },
    [layout, rows],
  );

  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) {
      return;
    }
    const target = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [],
    ).find((element) => element.dataset['rowId'] === id);
    if (target === undefined) {
      return;
    }
    pendingFocus.current = null;
    target.focus({ preventScroll: true });
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      target.getAttribute('role') !== 'treeitem' ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const result = exploreTreeKey({
      rows,
      activeId: target.dataset['rowId'] ?? null,
      key: event.key,
    });
    if (result.kind === 'none') {
      return;
    }
    event.preventDefault();
    if (result.kind === 'focus') {
      focusRow({ id: result.id });
      return;
    }
    if (result.kind === 'setExpanded') {
      onSetExpanded({ path: result.path, isExpanded: result.isExpanded });
      return;
    }
    const row = entries.find((candidate) => candidate.id === result.id);
    if (row === undefined) {
      return;
    }
    if (row.entry.isDir) {
      onSetExpanded({ path: row.entry.relPath, isExpanded: !row.isExpanded });
      return;
    }
    onSelectFile({ entry: row.entry });
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target === event.currentTarget) {
      if (effectiveActiveId !== null) {
        focusRow({ id: effectiveActiveId });
      }
      return;
    }
    const id = target instanceof HTMLElement ? target.dataset['rowId'] : undefined;
    if (id !== undefined) {
      setActiveId(id);
    }
  };

  return (
    <ScrollFade className="@container min-h-0 flex-1" fadeSize={24} viewportRef={viewportRef}>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Files"
        tabIndex={isActiveRendered || entries.length === 0 ? undefined : 0}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        style={isWindowed ? { paddingTop: padTop, paddingBottom: padBottom } : undefined}
        className="flex min-w-0 flex-col outline-none"
      >
        {shownRows.map((row) =>
          row.kind === 'entry' ? (
            <ExploreRow
              key={row.id}
              sessionId={sessionId}
              row={row}
              target={targetOf(row)}
              now={now}
              isActive={row.id === effectiveActiveId}
              isSelected={!row.entry.isDir && row.entry.relPath === selectedRelPath}
              isAskOpen={askPath === row.entry.relPath}
              onToggle={onSetExpanded}
              onSelectFile={onSelectFile}
              onRun={handleRun}
              onAskClosed={handleAskClosed}
            />
          ) : (
            <ExploreStatusRow key={row.id} row={row} onRetry={onLoad} />
          ),
        )}
      </div>
    </ScrollFade>
  );
};
