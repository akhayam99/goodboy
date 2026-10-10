import { Check, ChevronRight, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD, splitPath } from '../../lib/fileStatus';
import type { ViewedState } from '../../lib/reviewedFiles';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { DiffFileActionTarget } from '../../../actions/types';

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
  const target: DiffFileActionTarget = {
    kind: 'diffFile',
    facts: { path: file.path, onOpenInEditor, onCommentOnFile },
  };
  const menu = useObjectMenuTrigger({ target, anchorKey: `diff-file:${file.path}` });

  return (
    <div
      data-slot="diff-file-header"
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className="sticky top-0 z-10 flex h-9 min-w-0 items-center gap-2 rounded-md bg-subtle pl-1 pr-2 font-sans"
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
            'flex size-4 shrink-0 items-center justify-center rounded-sm text-chip font-semibold',
            tone.text,
            tone.bg,
          )}
        >
          {STATUS_LETTER[file.status]}
        </span>
        <span className="flex min-w-0 items-baseline gap-2 text-code" title={file.path}>
          <span className="min-w-0 truncate">
            <span className="text-faint-foreground">{dir}</span>
            <span className="text-foreground">{name}</span>
          </span>
          {file.status === 'renamed' && file.oldPath !== undefined ? (
            <span className="min-w-0 truncate text-meta text-faint-foreground">
              from {file.oldPath}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-meta tabular-nums">
          {file.additions > 0 ? <span className="text-success">+{file.additions}</span> : null}
          {file.additions > 0 && file.deletions > 0 ? ' ' : null}
          {file.deletions > 0 ? <span className="text-danger">−{file.deletions}</span> : null}
        </span>
      </button>
      {commentCount > 0 ? (
        <span
          aria-label={`${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
          className="flex shrink-0 items-center gap-1 text-meta tabular-nums text-muted-foreground"
        >
          <MessageSquare size={ICON_SIZE.row} aria-hidden />
          {commentCount}
        </span>
      ) : null}
      {viewed === 'stale' ? (
        <span className="shrink-0 text-meta text-faint-foreground">Changed since viewed</span>
      ) : null}
      {onCommentOnFile ? (
        <Tooltip content="Comment on file" anchorClassName="shrink-0">
          <button
            type="button"
            onClick={onCommentOnFile}
            aria-label="Comment on file"
            data-file-comment-trigger=""
            className="inline-flex size-6 items-center justify-center rounded-sm text-faint-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <MessageSquarePlus size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
      ) : null}
      {onToggleViewed ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={isViewed}
          onClick={onToggleViewed}
          className={cn(
            'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-2 text-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            isViewed
              ? 'border-transparent text-success'
              : 'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
          )}
        >
          {isViewed ? (
            <Check size={ICON_SIZE.mark} aria-hidden />
          ) : (
            <span aria-hidden className="size-2.5 rounded-sm border border-border" />
          )}
          Viewed
        </button>
      ) : null}
      <ObjectOverflowMenu
        target={target}
        label={`More actions for ${file.path}`}
        anchorKey={`diff-file:${file.path}`}
        hideWhenEmpty
      />
    </div>
  );
};
