import type { ReactNode } from 'react';
import { cn, Tooltip } from '@goodboy/ui';
import type { ShortcutId } from '../../../shared/keyboard/registry';

export const FOOTER_LABELED_PAD = 'gap-2 px-2';
export const FOOTER_LABEL = 'hidden @min-chrome-labels/footer:inline';

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly shortcut?: ShortcutId;
  readonly onClick: () => void;
  readonly isCurrent?: boolean;
  readonly showLabel?: boolean;
};

export const FooterButton = ({
  icon,
  label,
  shortcut,
  onClick,
  isCurrent = false,
  showLabel = true,
}: Props) => (
  <Tooltip content={label} shortcut={shortcut}>
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-md py-1 text-chip transition-colors',
        showLabel ? FOOTER_LABELED_PAD : 'px-2',
        isCurrent
          ? 'cursor-default bg-overlay-selected text-foreground'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      <span className="flex items-center">{icon}</span>
      {showLabel ? <span className={FOOTER_LABEL}>{label}</span> : null}
    </button>
  </Tooltip>
);
