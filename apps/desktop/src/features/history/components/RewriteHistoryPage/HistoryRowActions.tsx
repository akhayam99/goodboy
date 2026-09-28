import { GitMerge, PenLine, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isFolded: boolean;
  readonly isRemoved: boolean;
  readonly canRemove: boolean;
  readonly canFoldDown: boolean;
  readonly onRename: () => void;
  readonly onFoldDown: () => void;
  readonly onToggleRemove: () => void;
  readonly onSeparate: () => void;
};

export const HistoryRowActions = ({
  isFolded,
  isRemoved,
  canRemove,
  canFoldDown,
  onRename,
  onFoldDown,
  onToggleRemove,
  onSeparate,
}: Props) => (
  <span className="pointer-events-none absolute right-1.5 top-2 flex items-center gap-0.5 rounded-lg border border-border-soft bg-elevated p-0.5 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
    {isFolded ? (
      <Button size="sm" variant="ghost" onClick={onSeparate}>
        <Undo2 size={ICON_SIZE.row} aria-hidden />
        Separate
      </Button>
    ) : (
      <>
        <Button size="sm" variant="ghost" title="Rename (reword) · R" onClick={onRename}>
          <PenLine size={ICON_SIZE.row} aria-hidden />
          Rename
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title="Fold into the one below (fixup) · C"
          disabled={!canFoldDown}
          onClick={onFoldDown}
        >
          <GitMerge size={ICON_SIZE.row} aria-hidden />
          Fold down
        </Button>
        {isRemoved ? (
          <Button size="sm" variant="ghost" title="Keep it" onClick={onToggleRemove}>
            <Undo2 size={ICON_SIZE.row} aria-hidden />
            Keep
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            title={canRemove ? 'Remove (drop) · Delete' : 'Separate what it takes in first'}
            disabled={!canRemove}
            onClick={onToggleRemove}
          >
            <Trash2 size={ICON_SIZE.row} aria-hidden />
            Remove
          </Button>
        )}
      </>
    )}
  </span>
);
