import { cn } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { LENS_ICON } from '../../lens-labels';
import type { LensMenuEntry } from './lensSwitcherGroups';

type DestinationRowProps = {
  readonly entry: LensMenuEntry;
  readonly label: string;
  readonly isCurrent: boolean;
  readonly onSelect: (lens: LensKind) => void;
};

export const DestinationRow = ({ entry, label, isCurrent, onSelect }: DestinationRowProps) => {
  const Icon = LENS_ICON[entry.lens];
  const glyphs = shortcutGlyphs(entry.shortcut);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onSelect(entry.lens)}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        isCurrent
          ? 'bg-background text-foreground'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {glyphs === '' ? null : (
        <span className="shrink-0 text-2xs tracking-wide text-muted-foreground/60">{glyphs}</span>
      )}
    </button>
  );
};
