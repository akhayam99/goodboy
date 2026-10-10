import type { MouseEvent } from 'react';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn, ROW_INTERACTIVE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ExploreFileActionTarget } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { MiddleText } from '../../../../shared/components/MiddleText';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type {
  RunRowActionParams,
  SelectFileParams,
  SetExpandedParams,
} from '../../exploreHandlers';
import type { ExploreEntryRow } from '../../exploreRows';
import { fileGlyphOf } from '../../fileGlyph';
import { ExploreIndent } from './ExploreIndent';
import { ExploreRowActions } from './ExploreRowActions';

type Props = {
  readonly sessionId: SessionId;
  readonly row: ExploreEntryRow;
  readonly target: ExploreFileActionTarget;
  readonly now: number;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isAskOpen: boolean;
  readonly onToggle: (params: SetExpandedParams) => void;
  readonly onSelectFile: (params: SelectFileParams) => void;
  readonly onRun: (params: RunRowActionParams) => void;
  readonly onAskClosed: () => void;
};

const EXTENSION = /\.[^./]*$/;

const FADE_ON_ACTIONS =
  'group-hover/explore-row:opacity-0 group-focus-within/explore-row:opacity-0 motion-safe:transition-opacity';

export const ExploreRow = ({
  sessionId,
  row,
  target,
  now,
  isActive,
  isSelected,
  isAskOpen,
  onToggle,
  onSelectFile,
  onRun,
  onAskClosed,
}: Props) => {
  const { entry } = row;
  const menu = useObjectMenuTrigger({ target, anchorKey: `explore:${entry.relPath}` });
  const Glyph = entry.isDir
    ? row.isExpanded
      ? FolderOpen
      : Folder
    : fileGlyphOf({ name: entry.name });
  const age = entry.modifiedAt === null ? '' : formatAge({ from: entry.modifiedAt, now });
  const fade = cn(FADE_ON_ACTIONS, isAskOpen && 'opacity-0');

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('[data-slot="explore-row-actions"]') !== null
    ) {
      return;
    }
    if (entry.isDir) {
      onToggle({ path: entry.relPath, isExpanded: !row.isExpanded });
      return;
    }
    onSelectFile({ entry });
  };

  return (
    <div
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={entry.isDir ? row.isExpanded : undefined}
      aria-selected={isSelected}
      aria-label={entry.name}
      tabIndex={isActive ? 0 : -1}
      data-row-id={row.id}
      onClick={handleClick}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn(
        'group/explore-row relative flex h-10 w-full min-w-0 items-center gap-2 rounded-md pl-2 pr-3 text-left',
        ROW_INTERACTIVE,
        isSelected && 'bg-overlay-selected',
      )}
    >
      <ExploreIndent depth={row.depth} />
      {entry.isDir ? (
        <ChevronRight
          size={ICON_SIZE.control}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground motion-safe:transition-transform',
            row.isExpanded && 'rotate-90',
          )}
        />
      ) : (
        <span aria-hidden className="w-3.5 shrink-0" />
      )}
      <Glyph size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 text-row text-foreground">
        {entry.isDir ? (
          <span className="truncate">{entry.name}</span>
        ) : (
          <MiddleText value={entry.name} tail={EXTENSION} />
        )}
      </span>
      <span aria-hidden data-slot="explore-change-slot" className="size-4 shrink-0" />
      <span
        data-slot="explore-size"
        className={cn(
          'w-14 shrink-0 text-right text-meta tabular-nums text-faint-foreground @max-[520px]:hidden',
          fade,
        )}
      >
        {entry.isDir ? '' : formatBytes({ bytes: entry.sizeBytes })}
      </span>
      <span
        data-slot="explore-age"
        className={cn(
          'w-16 shrink-0 text-right text-meta tabular-nums text-faint-foreground @max-[440px]:hidden',
          fade,
        )}
      >
        {age}
      </span>
      <span aria-hidden className="hidden w-20 shrink-0 @max-[440px]:block" />
      <ExploreRowActions
        sessionId={sessionId}
        target={target}
        isAskOpen={isAskOpen}
        onRun={onRun}
        onAskClosed={onAskClosed}
      />
    </div>
  );
};
