import { forwardRef } from 'react';
import { ListTree } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ProgressRing } from './ProgressRing';

type Props = {
  readonly viewed: number;
  readonly total: number;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

export const TreeStrip = forwardRef<HTMLButtonElement, Props>(
  ({ viewed, total, isOpen, onToggle }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-expanded={isOpen}
      aria-label={`Files, ${viewed} of ${total} viewed`}
      title={`Files (${shortcutGlyphs('diff.focusTree')})`}
      onClick={onToggle}
      className={cn(
        'flex h-full w-11 shrink-0 flex-col items-center gap-3 rounded-sm pt-3 text-muted-foreground',
        ROW_INTERACTIVE,
        isOpen && 'bg-overlay-selected',
      )}
    >
      <ListTree size={ICON_SIZE.row} aria-hidden />
      <ProgressRing viewed={viewed} total={total} />
      <span className="text-meta tabular-nums">
        {viewed}/{total}
      </span>
    </button>
  ),
);

TreeStrip.displayName = 'TreeStrip';
