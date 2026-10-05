import { useEffect, useMemo, useRef } from 'react';
import { Check, ChevronRight, MessageSquare } from 'lucide-react';
import { ScrollFade, cn, tintClasses } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { visibleRows, type ChangeTree as ChangeTreeModel } from '../../lib/changeTree';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD } from '../../lib/fileStatus';
import type { ViewedState } from '../../lib/reviewedFiles';
import { Delta } from './Delta';
import { ProgressRing } from './ProgressRing';

type Props = {
  readonly tree: ChangeTreeModel;
  readonly activePath: string | null;
  readonly collapsed: ReadonlySet<string>;
  readonly onToggleFolder: (id: string) => void;
  readonly onPick: (path: string) => void;
  readonly stateOf: (file: FileDiff) => ViewedState;
  readonly noteCountOf: (path: string) => number;
};

const INDENT_PX = 12;
const BASE_PX = 8;

export const ChangeTree = ({
  tree,
  activePath,
  collapsed,
  onToggleFolder,
  onPick,
  stateOf,
  noteCountOf,
}: Props) => {
  const rows = useMemo(() => visibleRows({ rows: tree.rows, collapsed }), [tree.rows, collapsed]);
  const states = useMemo(
    () => new Map(tree.files.map((file) => [file.path, stateOf(file)] as const)),
    [tree.files, stateOf],
  );
  const viewedCount = useMemo(
    () => [...states.values()].filter((state) => state === 'viewed').length,
    [states],
  );
  const share = tree.files.length === 0 ? 0 : viewedCount / tree.files.length;
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activePath]);

  return (
    <nav aria-label="Changed files" className="flex min-h-0 w-full min-w-0 flex-col">
      <div className="flex flex-col gap-2 px-3 pb-2">
        <p className="text-meta tabular-nums text-muted-foreground">
          {viewedCount} of {tree.files.length} viewed
        </p>
        <span
          aria-hidden
          className="relative block h-0.5 overflow-hidden rounded-full bg-border-soft"
        >
          <span
            className="absolute inset-y-0 left-0 block rounded-full bg-primary"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      </div>
      <ScrollFade className="min-h-0 flex-1" fadeSize="h-6">
        <ul className="flex min-w-0 flex-col px-1 pb-4">
          {rows.map((row) => {
            const indent = BASE_PX + row.depth * INDENT_PX;
            if (row.kind === 'folder') {
              const isOpen = !collapsed.has(row.id);
              return (
                <li key={row.id} className="list-none">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    title={row.id}
                    onClick={() => onToggleFolder(row.id)}
                    style={{ paddingLeft: indent }}
                    className="flex h-7 w-full min-w-0 items-center gap-2 rounded-sm pr-2 text-left text-row hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <ChevronRight
                      size={ICON_SIZE.row}
                      aria-hidden
                      className={cn(
                        'shrink-0 text-muted-foreground duration-150 motion-safe:transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    />
                    <ProgressRing
                      viewed={row.paths.filter((path) => states.get(path) === 'viewed').length}
                      total={row.fileCount}
                    />
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
                      {row.fileCount}
                    </span>
                    <Delta additions={row.additions} deletions={row.deletions} />
                  </button>
                </li>
              );
            }
            const isActive = row.id === activePath;
            const state = states.get(row.id) ?? 'none';
            const viewed = state === 'viewed';
            const notes = noteCountOf(row.id);
            const tone = tintClasses(STATUS_TONE[row.file.status]);
            return (
              <li key={row.id} className="list-none">
                <button
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  title={row.id}
                  onClick={() => onPick(row.id)}
                  style={{ paddingLeft: indent + ICON_SIZE.row + 8 }}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2 rounded-sm py-1 pr-2 text-left text-body hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                    isActive && 'bg-overlay-selected',
                    viewed ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  <span className="flex w-4 shrink-0 items-center justify-center">
                    {viewed ? (
                      <Check
                        size={ICON_SIZE.row}
                        aria-label="Viewed"
                        className="text-muted-foreground"
                      />
                    ) : state === 'stale' ? (
                      <span
                        role="img"
                        aria-label="Changed since viewed"
                        className="size-2 rounded-full bg-warning"
                      />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        'truncate',
                        row.file.status === 'deleted' && 'text-faint-foreground line-through',
                      )}
                    >
                      {row.name}
                    </span>
                    {row.fromPath === null ? null : (
                      <span className="truncate text-meta text-faint-foreground">
                        from {row.fromPath}
                      </span>
                    )}
                  </span>
                  {notes > 0 ? (
                    <span
                      aria-label={`${notes} ${notes === 1 ? 'note' : 'notes'}`}
                      className="flex shrink-0 items-center gap-0.5 text-meta tabular-nums text-faint-foreground"
                    >
                      <MessageSquare size={ICON_SIZE.row} aria-hidden />
                      {notes}
                    </span>
                  ) : null}
                  <Delta additions={row.file.additions} deletions={row.file.deletions} />
                  <span
                    aria-label={STATUS_WORD[row.file.status]}
                    className={cn('w-3 shrink-0 text-center font-mono text-chip', tone.text)}
                  >
                    {STATUS_LETTER[row.file.status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollFade>
    </nav>
  );
};
