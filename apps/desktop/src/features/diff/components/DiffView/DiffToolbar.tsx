import type { ReactNode } from 'react';
import { ChevronDown, ListTree, WrapText } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  DiffLayoutToggle,
  KbdPill,
  cn,
  type DiffLayoutMode,
  type DropdownController,
} from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { FileJumpPopover } from './FileJumpPopover';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly activePath: string | null;
  readonly jump: DropdownController;
  readonly onJump: (path: string) => void;
  readonly commentCountOf: (path: string) => number;
  readonly isViewed: (file: FileDiff) => boolean;
  readonly viewedCount: number | null;
  readonly layout: DiffLayoutMode;
  readonly onLayout: (mode: DiffLayoutMode) => void;
  readonly wrap: boolean;
  readonly onWrap: (next: boolean) => void;
  readonly end?: ReactNode;
};

export const DiffToolbar = ({
  files,
  activePath,
  jump,
  onJump,
  commentCountOf,
  isViewed,
  viewedCount,
  layout,
  onLayout,
  wrap,
  onWrap,
  end,
}: Props) => {
  const fileWord = files.length === 1 ? 'file' : 'files';
  const isSplit = layout === 'split';
  const share = viewedCount === null || files.length === 0 ? 0 : viewedCount / files.length;
  return (
    <div data-slot="diff-toolbar" className="flex min-w-0 flex-wrap items-center gap-2">
      <AnchoredPopover
        dropdown={jump}
        role="dialog"
        ariaLabel="Jump to file"
        trigger={
          <Button
            variant="secondary"
            size="sm"
            onClick={jump.toggle}
            aria-haspopup="dialog"
            aria-expanded={jump.open}
            aria-keyshortcuts="T"
          >
            <ListTree size={ICON_SIZE.row} aria-hidden />
            {files.length} {fileWord}
            <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
            <KbdPill>T</KbdPill>
          </Button>
        }
      >
        {jump.open ? (
          <FileJumpPopover
            files={files}
            activePath={activePath}
            commentCountOf={commentCountOf}
            isViewed={isViewed}
            onPick={(path) => {
              jump.close();
              onJump(path);
            }}
          />
        ) : null}
      </AnchoredPopover>
      <div className="ml-auto flex items-center gap-2">
        {viewedCount !== null ? (
          <span className="flex items-center gap-1.5 text-2xs tabular-nums text-muted-foreground">
            {viewedCount} of {files.length} viewed
            <span
              aria-hidden
              className="relative block h-1 w-12 overflow-hidden rounded-full bg-border-soft"
            >
              <span
                className="absolute inset-y-0 left-0 block rounded-full bg-success"
                style={{ width: `${Math.round(share * 100)}%` }}
              />
            </span>
          </span>
        ) : null}
        <DiffLayoutToggle mode={layout} onChange={onLayout} />
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={isSplit || wrap}
          disabled={isSplit}
          title={isSplit ? 'Split view always wraps' : undefined}
          onClick={() => onWrap(!wrap)}
          className={cn((isSplit || wrap) && 'bg-hover text-foreground')}
        >
          <WrapText size={ICON_SIZE.row} aria-hidden />
          Wrap
        </Button>
        {end}
      </div>
    </div>
  );
};
