import { ChevronRight } from 'lucide-react';
import { cn, ICON_SIZE, ROW_INTERACTIVE, StatusDot, Tooltip, treeIndentPx } from '@goodboy/ui';

import { ViewedRing } from '../ViewedRing';
import type { TreeRow } from '../../lib/changeTree';
import { rowHeightOf } from '../../lib/rowHeightOf';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { Delta } from './Delta';

type FolderTreeRow = Extract<TreeRow, { readonly kind: 'folder' }>;

type Props = {
  readonly row: FolderTreeRow;
  readonly domId: string;
  readonly isOpen: boolean;
  readonly isMarked: boolean;
  readonly isCursor: boolean;
  readonly isTreeFocused: boolean;
  readonly viewedCount: number;
  readonly hasDelta: boolean;
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
  hasDelta,
  onToggle,
}: Props) => {
  const menu = useObjectMenuTrigger({
    target: {
      kind: 'item',
      facts: { name: row.label, openLabel: isOpen ? 'Collapse' : 'Expand', onOpen: onToggle },
    },
    anchorKey: `tree-folder:${row.id}`,
  });
  return (
    <li
      id={domId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={isOpen}
      aria-selected={isCursor}
      data-tree-row={row.id}
      onContextMenu={menu.onContextMenu}
      className={cn(
        'relative list-none rounded-sm',
        isCursor && isTreeFocused && 'ring-2 ring-inset ring-focus-ring',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggle}
        style={{ paddingLeft: treeIndentPx({ depth: row.depth }), height: rowHeightOf(row) }}
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
        <Tooltip
          content={`${row.fileCount} ${row.fileCount === 1 ? 'file' : 'files'}`}
          anchorClassName="min-w-0 flex-1"
        >
          <span className="block min-w-0 truncate">{row.label}</span>
        </Tooltip>
        {isMarked ? (
          <StatusDot size="sm" tone="primary" ariaLabel="contains the file in view" />
        ) : null}
        {isOpen || !hasDelta ? null : (
          <>
            <Delta additions={row.additions} deletions={row.deletions} isMuted />
            <span aria-hidden className="w-3 shrink-0" />
          </>
        )}
      </button>
    </li>
  );
};
