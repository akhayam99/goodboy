import type { KeyboardEvent, Ref } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../cn';
import { tintClasses } from '../../tint';
import type { MenuItemEntry } from './menuTypes';

const dangerTint = tintClasses('danger');

type Props = {
  readonly entry: MenuItemEntry;
  readonly isExpanded: boolean;
  readonly rowRef?: Ref<HTMLButtonElement>;
  readonly onActivate: () => void;
  readonly onHover: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

export const MenuRow = ({ entry, isExpanded, rowRef, onActivate, onHover, onKeyDown }: Props) => {
  const Icon = entry.icon;
  const isBlocked = entry.blockedReason != null;
  const hasChoices = entry.choices != null && entry.choices.length > 0;
  const detail = entry.blockedReason ?? entry.description ?? null;
  return (
    <button
      ref={rowRef}
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-menu-label={entry.label}
      aria-disabled={isBlocked || undefined}
      aria-haspopup={hasChoices ? 'menu' : undefined}
      aria-expanded={hasChoices ? isExpanded : undefined}
      aria-description={entry.blockedReason ?? undefined}
      onClick={onActivate}
      onMouseEnter={onHover}
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full gap-2 rounded-sm px-2 text-left focus-visible:outline-none motion-safe:transition-colors',
        detail === null ? 'items-center py-2' : 'items-start py-2',
        isBlocked
          ? 'cursor-not-allowed text-disabled-foreground focus:bg-hover'
          : entry.isDestructive === true
            ? cn(dangerTint.text, dangerTint.hoverBg, dangerTint.hoverText, 'focus:bg-hover')
            : 'text-foreground hover:bg-hover focus:bg-hover',
        isExpanded && 'bg-hover',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
        {Icon === undefined ? null : (
          <Icon
            size={12}
            aria-hidden
            className={cn(
              isBlocked
                ? 'text-disabled-foreground'
                : entry.isDestructive === true
                  ? dangerTint.icon
                  : 'text-faint-foreground',
            )}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{entry.label}</span>
        {detail === null ? null : <span className="text-meta text-faint-foreground">{detail}</span>}
      </span>
      {entry.hint == null ? null : (
        <kbd className="shrink-0 font-mono text-meta text-faint-foreground">{entry.hint}</kbd>
      )}
      {hasChoices ? (
        <ChevronRight size={12} aria-hidden className="shrink-0 text-faint-foreground" />
      ) : null}
    </button>
  );
};
