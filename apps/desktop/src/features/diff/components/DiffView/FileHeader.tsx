import { ChevronRight, MessageSquare } from 'lucide-react';
import { Button, Checkbox, Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD, splitPath } from '../../lib/fileStatus';
import type { ViewedState } from '../../lib/reviewedFiles';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { DiffFileActionTarget } from '../../../actions/types';

type Props = {
  readonly file: FileDiff;
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly commentCount: number;
  readonly viewed: ViewedState | null;
  readonly onToggleViewed: (() => void) | null;
  readonly onOpenInEditor: (() => void) | null;
  readonly onShowWhole: (() => void) | null;
  readonly onOpenInDrawer: (() => void) | null;
  readonly onCommentOnFile: (() => void) | null;
};

const STALE_TIP = 'Changed since you viewed it';

const FILE_HEADER_PX = 44;

export const FileHeader = ({
  file,
  isCollapsed,
  onToggleCollapsed,
  commentCount,
  viewed,
  onToggleViewed,
  onOpenInEditor,
  onShowWhole,
  onOpenInDrawer,
  onCommentOnFile,
}: Props) => {
  const { dir, name } = splitPath(file.path);
  const tone = tintClasses(STATUS_TONE[file.status]);
  const isViewed = viewed === 'viewed';
  const isStale = viewed === 'stale';
  const target: DiffFileActionTarget = {
    kind: 'diffFile',
    facts: { path: file.path, onOpenInEditor, onShowWhole, onOpenInDrawer },
  };
  const menu = useObjectMenuTrigger({ target, anchorKey: `diff-file:${file.path}` });
  const pathTip =
    file.status === 'renamed' && file.oldPath !== undefined ? (
      <span className="flex flex-col gap-0.5 text-code">
        <span>{file.path}</span>
        <span className="text-faint-foreground">from {file.oldPath}</span>
      </span>
    ) : (
      <span className="text-code">{file.path}</span>
    );

  return (
    <div
      data-slot="diff-file-header"
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn(
        'sticky top-0 z-10 flex min-w-0 items-center gap-2 bg-subtle pl-1 pr-2 font-sans',
        isCollapsed ? 'rounded-lg' : 'rounded-t-lg',
      )}
      style={{ height: FILE_HEADER_PX }}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
        className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md pl-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground duration-150 motion-safe:transition-transform',
            !isCollapsed && 'rotate-90',
          )}
        />
        <span
          aria-label={STATUS_WORD[file.status]}
          className={cn(
            'flex size-[18px] shrink-0 items-center justify-center rounded-sm text-chip font-semibold',
            tone.text,
            tone.bg,
          )}
        >
          {STATUS_LETTER[file.status]}
        </span>
        <Tooltip content={pathTip} anchorClassName="min-w-0 flex-1">
          <span dir="rtl" className="min-w-0 flex-1 truncate text-left text-code">
            <bdi dir="ltr">
              <span className="text-faint-foreground">{dir}</span>
              <span className="text-foreground">{name}</span>
            </bdi>
          </span>
        </Tooltip>
        <span className="shrink-0 text-meta tabular-nums">
          {file.additions > 0 ? <span className="text-success">+{file.additions}</span> : null}
          {file.additions > 0 && file.deletions > 0 ? ' ' : null}
          {file.deletions > 0 ? <span className="text-danger">−{file.deletions}</span> : null}
        </span>
      </button>
      {onToggleViewed === null ? null : (
        <Tooltip content={STALE_TIP} isSuppressed={!isStale} anchorClassName="shrink-0">
          <span className="inline-flex">
            <Checkbox
              checked={isViewed}
              onChange={onToggleViewed}
              label={
                <>
                  Viewed
                  {isStale ? (
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
                  ) : null}
                </>
              }
              className="h-7 shrink-0 rounded-md pl-0.5 pr-2 text-label text-muted-foreground hover:bg-hover hover:text-foreground"
            />
          </span>
        </Tooltip>
      )}
      {onCommentOnFile === null ? null : (
        <Button
          size="sm"
          variant="quiet"
          data-file-comment-trigger=""
          onClick={onCommentOnFile}
          className="shrink-0"
        >
          <MessageSquare size={ICON_SIZE.row} aria-hidden />
          Comment
          {commentCount > 0 ? (
            <span className="tabular-nums text-faint-foreground">{commentCount}</span>
          ) : null}
        </Button>
      )}
      <ObjectOverflowMenu
        target={target}
        label={`More actions for ${file.path}`}
        anchorKey={`diff-file:${file.path}`}
        size="control"
        hideWhenEmpty
      />
    </div>
  );
};
