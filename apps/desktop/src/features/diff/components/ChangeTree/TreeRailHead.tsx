import { PanelLeftClose } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

type Props = {
  readonly count: number | null;
  readonly isOverlay: boolean;
  readonly onFold: (() => void) | null;
};

export const TreeRailHead = ({ count, isOverlay, onFold }: Props) => (
  <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-3">
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="text-row">Files</span>
      {count === null ? null : (
        <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
      )}
    </div>
    {onFold === null ? null : (
      <IconButton
        icon={PanelLeftClose}
        iconSize={ICON_SIZE.control}
        variant="ghost"
        label={isOverlay ? 'Close the file rail' : 'Fold the file rail'}
        tooltip={isOverlay ? 'Close (Esc)' : `Fold (${shortcutGlyphs('diff.toggleTree')})`}
        onClick={onFold}
      />
    )}
  </div>
);
