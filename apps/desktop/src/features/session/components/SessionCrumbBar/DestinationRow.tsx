import type { LucideIcon } from 'lucide-react';
import { Chip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';

type DestinationRowProps = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly shortcut: ShortcutId;
  readonly isCurrent: boolean;
  readonly count: number | null;
  readonly onSelect: () => void;
};

export const DestinationRow = ({
  label,
  icon: Icon,
  shortcut,
  isCurrent,
  count,
  onSelect,
}: DestinationRowProps) => {
  const glyphs = shortcutGlyphs(shortcut);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        isCurrent
          ? 'bg-background text-foreground'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count === null || count === 0 ? null : (
        <Chip size="3xs" tone="info" bordered={false} label={String(count)} />
      )}
      {glyphs === '' ? null : (
        <span className="shrink-0 text-2xs tracking-wide text-faint-foreground">{glyphs}</span>
      )}
    </button>
  );
};
