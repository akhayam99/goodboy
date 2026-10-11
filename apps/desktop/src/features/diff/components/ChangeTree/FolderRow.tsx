import { ChevronRight } from 'lucide-react';
import { ROW_INTERACTIVE, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ViewedRing } from '../../../../shared/components/ViewedRing';
import { folderPathOf, type TreeRow } from '../../lib/changeTree';
import { rowHeightOf } from '../../lib/rowHeightOf';
import { Delta } from './Delta';
import { TREE_BASE_PX, TREE_INDENT_PX, TreeGuides } from './TreeGuides';

type FolderTreeRow = Extract<TreeRow, { readonly kind: 'folder' }>;

type Props = {
  readonly row: FolderTreeRow;
  readonly domId: string;
  readonly isOpen: boolean;
  readonly isMarked: boolean;
  readonly isCursor: boolean;
  readonly isTreeFocused: boolean;
  readonly viewedCount: number;
  readonly onToggle: () => void;
};

export const FolderRow = ({
  row,
  domId,
  isOpen,
  isMarked,
  isCursor,
  isTreeFocused,
  viewedCount,
  onToggle,
}: Props) => {
  const folderPath = folderPathOf({ id: row.id });
  const button = (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      style={{ paddingLeft: TREE_BASE_PX + row.depth * TREE_INDENT_PX, height: rowHeightOf(row) }}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-sm pr-2 text-left text-row',
        ROW_INTERACTIVE,
      )}
    >
      <ChevronRight
        size={ICON_SIZE.row}
        aria-hidden
        className={cn(
          'shrink-0 text-muted-foreground duration-150 motion-safe:transition-transform',
          isOpen && 'rotate-90',
        )}
      />
      <ViewedRing viewed={viewedCount} total={row.fileCount} />
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      {isMarked ? (
        <span
          role="img"
          aria-label="contains the file in view"
          className="size-1.5 shrink-0 rounded-full bg-primary"
        />
      ) : null}
      {isOpen ? null : (
        <>
          <span data-tone="muted" className="shrink-0 text-meta tabular-nums text-faint-foreground">
            {row.fileCount}
          </span>
          <Delta additions={row.additions} deletions={row.deletions} isMuted />
        </>
      )}
    </button>
  );
  return (
    <li
      id={domId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={isOpen}
      aria-selected={isCursor}
      data-row-id={row.id}
      className={cn(
        'relative list-none rounded-sm',
        isCursor && isTreeFocused && 'ring-2 ring-inset ring-focus-ring',
      )}
    >
      <TreeGuides depth={row.depth} />
      {folderPath === null ? (
        button
      ) : (
        <Tooltip
          content={<span className="text-code">{folderPath}</span>}
          anchorClassName="flex w-full"
        >
          {button}
        </Tooltip>
      )}
    </li>
  );
};
