import { Check, MessageSquare } from 'lucide-react';
import { FOCUS_RING, ROW_INTERACTIVE, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { MiddleText } from '../../../../shared/components/MiddleText';
import { kindsLabelOf, type CommentKinds } from '../../lib/commentKinds';
import { cutFileName } from '../../lib/cutFileName';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD } from '../../lib/fileStatus';
import type { TreeRow } from '../../lib/changeTree';
import type { ViewedState } from '../../lib/reviewedFiles';
import { rowHeightOf } from '../../lib/rowHeightOf';
import { Delta } from './Delta';
import { TREE_BASE_PX, TREE_INDENT_PX } from './treeMetrics';

type FileTreeRow = Extract<TreeRow, { readonly kind: 'file' }>;

type Props = {
  readonly row: FileTreeRow;
  readonly domId: string;
  readonly isActive: boolean;
  readonly isCursor: boolean;
  readonly isTreeFocused: boolean;
  readonly state: ViewedState;
  readonly kinds: CommentKinds;
  readonly nameLength: number | null;
  readonly hasDelta: boolean;
  readonly canToggleViewed: boolean;
  readonly onPick: () => void;
  readonly onToggleViewed: () => void;
};

const EXTENSION = /\.[^./]*$/;
const LAST_SEGMENT = /[^/]*$/;
const TOGGLE_SLOT_PX = 22;

type TipParams = {
  readonly state: ViewedState;
};

const viewedTipOf = ({ state }: TipParams): string => {
  if (state === 'viewed') {
    return 'Viewed';
  }
  return state === 'stale' ? 'Changed since you viewed it' : 'Mark as viewed';
};

export const FileRow = ({
  row,
  domId,
  isActive,
  isCursor,
  isTreeFocused,
  state,
  kinds,
  nameLength,
  hasDelta,
  canToggleViewed,
  onPick,
  onToggleViewed,
}: Props) => {
  const indent = TREE_BASE_PX + row.depth * TREE_INDENT_PX;
  const isViewed = state === 'viewed';
  const count = kinds.notes + kinds.host;
  const tone = tintClasses(STATUS_TONE[row.file.status]);
  const shownName =
    nameLength === null ? row.name : cutFileName({ name: row.name, maxLength: nameLength });
  return (
    <li
      id={domId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isCursor}
      aria-current={isActive ? 'true' : undefined}
      data-tree-row={row.id}
      className={cn(
        'relative list-none rounded-sm',
        isCursor && isTreeFocused && 'ring-2 ring-inset ring-focus-ring',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={onPick}
        style={{ paddingLeft: indent + TOGGLE_SLOT_PX, height: rowHeightOf(row) }}
        className={cn(
          'flex w-full min-w-0 items-center gap-2 rounded-sm pr-2 text-left text-body',
          ROW_INTERACTIVE,
          isActive && 'bg-overlay-selected',
          isViewed ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <Tooltip
          content={<span className="text-code">{row.id}</span>}
          anchorClassName="min-w-0 flex-1"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                className={cn(
                  'truncate',
                  row.file.status === 'deleted' && 'text-faint-foreground line-through',
                )}
              >
                {shownName === row.name ? (
                  <MiddleText value={row.name} tail={EXTENSION} />
                ) : (
                  <>
                    <span className="sr-only">{row.name}</span>
                    <span aria-hidden>{shownName}</span>
                  </>
                )}
              </span>
              {row.dir === null ? null : (
                <span className="min-w-0 truncate text-meta text-faint-foreground">{row.dir}</span>
              )}
            </span>
            {row.fromPath === null ? null : (
              <span className="flex min-w-0 gap-1 text-meta text-faint-foreground">
                <span className="sr-only">from {row.fromPath}</span>
                <span aria-hidden className="shrink-0">
                  from
                </span>
                <MiddleText value={row.fromPath} tail={LAST_SEGMENT} />
              </span>
            )}
          </span>
        </Tooltip>
        {count === 0 ? null : (
          <Tooltip content={kindsLabelOf({ kinds })} anchorClassName="shrink-0">
            <span
              role="img"
              aria-label={kindsLabelOf({ kinds })}
              className="flex items-center gap-0.5 text-meta tabular-nums text-faint-foreground"
            >
              <MessageSquare size={ICON_SIZE.mark} aria-hidden />
              {count}
            </span>
          </Tooltip>
        )}
        {hasDelta ? <Delta additions={row.file.additions} deletions={row.file.deletions} /> : null}
        <span
          aria-label={STATUS_WORD[row.file.status]}
          className={cn('w-3 shrink-0 text-center text-chip', tone.text)}
        >
          {STATUS_LETTER[row.file.status]}
        </span>
      </button>
      {canToggleViewed ? (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: indent + 2 }}>
          <Tooltip content={viewedTipOf({ state })} anchorClassName="flex">
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Viewed: ${row.name}`}
              aria-pressed={isViewed}
              onClick={onToggleViewed}
              className={cn(
                'flex size-4 items-center justify-center rounded-sm border text-background',
                FOCUS_RING,
                isViewed ? 'border-primary bg-primary' : 'border-border bg-transparent',
              )}
            >
              {isViewed ? <Check size={ICON_SIZE.mark} strokeWidth={3} aria-hidden /> : null}
              {state === 'stale' ? (
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              ) : null}
            </button>
          </Tooltip>
        </div>
      ) : null}
    </li>
  );
};
