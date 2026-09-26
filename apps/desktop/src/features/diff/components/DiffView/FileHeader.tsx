import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  MessageSquare,
  MessageSquarePlus,
} from 'lucide-react';
import { OverflowMenu, cn, tintClasses, type OverflowMenuItem } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD, splitPath } from '../../lib/fileStatus';
import type { ViewedState } from '../../lib/reviewedFiles';

type Props = {
  readonly file: FileDiff;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly commentCount: number;
  readonly viewed: ViewedState | null;
  readonly onToggleViewed: (() => void) | null;
  readonly onOpenInEditor: (() => void) | null;
  readonly onCommentOnFile: (() => void) | null;
};

const BLOCKS = 5;

const changeBlocks = (
  additions: number,
  deletions: number,
): ReadonlyArray<'add' | 'del' | 'none'> => {
  const total = additions + deletions;
  const filled = Math.min(BLOCKS, total);
  const adds = total === 0 ? 0 : Math.round((filled * additions) / total);
  return Array.from({ length: BLOCKS }, (_, index) =>
    index < adds ? 'add' : index < filled ? 'del' : 'none',
  );
};

const BLOCK_CLASS = {
  add: 'bg-success',
  del: 'bg-danger',
  none: 'bg-border-soft',
} as const;

export const FileHeader = ({
  file,
  collapsed,
  onToggleCollapsed,
  commentCount,
  viewed,
  onToggleViewed,
  onOpenInEditor,
  onCommentOnFile,
}: Props) => {
  const { dir, name } = splitPath(file.path);
  const tone = tintClasses(STATUS_TONE[file.status]);
  const isViewed = viewed === 'viewed';
  const items: OverflowMenuItem[] = [
    ...(onOpenInEditor
      ? [
          {
            kind: 'item' as const,
            key: 'open',
            label: 'Open in editor',
            icon: ExternalLink,
            onClick: onOpenInEditor,
          },
        ]
      : []),
    {
      kind: 'item',
      key: 'copy',
      label: 'Copy path',
      icon: Copy,
      onClick: () => void navigator.clipboard?.writeText(file.path),
    },
    ...(onCommentOnFile
      ? [
          {
            kind: 'item' as const,
            key: 'comment',
            label: 'Comment on file',
            icon: MessageSquarePlus,
            onClick: onCommentOnFile,
          },
        ]
      : []),
  ];

  return (
    <div
      data-slot="diff-file-header"
      className="sticky top-0 z-10 flex h-9 min-w-0 items-center gap-2 rounded-md bg-subtle pl-1 pr-1.5 font-sans"
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 pl-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground duration-150 motion-safe:transition-transform',
            !collapsed && 'rotate-90',
          )}
        />
        <span
          aria-label={STATUS_WORD[file.status]}
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-meta font-semibold',
            tone.text,
            tone.bg,
          )}
        >
          {STATUS_LETTER[file.status]}
        </span>
        <span className="min-w-0 truncate text-code" title={file.path}>
          <span className="text-faint-foreground">{dir}</span>
          <span className="text-foreground">{name}</span>
        </span>
        <span className="shrink-0 text-secondary tabular-nums">
          {file.additions > 0 ? <span className="text-success">+{file.additions}</span> : null}
          {file.additions > 0 && file.deletions > 0 ? ' ' : null}
          {file.deletions > 0 ? <span className="text-danger">−{file.deletions}</span> : null}
        </span>
        <span aria-hidden className="flex shrink-0 gap-px">
          {changeBlocks(file.additions, file.deletions).map((kind, index) => (
            <i key={index} className={cn('block size-1.5 rounded-sm', BLOCK_CLASS[kind])} />
          ))}
        </span>
      </button>
      {commentCount > 0 ? (
        <span
          aria-label={`${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
          className="flex shrink-0 items-center gap-1 text-secondary tabular-nums text-muted-foreground"
        >
          <MessageSquare size={ICON_SIZE.row} aria-hidden />
          {commentCount}
        </span>
      ) : null}
      {viewed === 'stale' ? (
        <span className="shrink-0 text-secondary text-faint-foreground">Changed since viewed</span>
      ) : null}
      {onToggleViewed ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={isViewed}
          onClick={onToggleViewed}
          className={cn(
            'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-secondary font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            isViewed
              ? 'border-transparent text-success'
              : 'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
          )}
        >
          {isViewed ? (
            <Check size={10} aria-hidden />
          ) : (
            <span aria-hidden className="size-2.5 rounded-sm border border-border" />
          )}
          Viewed
        </button>
      ) : null}
      <OverflowMenu items={items} label={`More actions for ${file.path}`} align="right" />
    </div>
  );
};
