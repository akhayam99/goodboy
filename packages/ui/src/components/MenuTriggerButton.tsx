import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { Tooltip } from './Tooltip';

export type MenuTriggerSize = 'compact' | 'control';

const DEFAULT_TOOLTIP = 'More actions';

const TRIGGER_SIZE: Record<MenuTriggerSize, string> = { compact: 'size-6', control: 'size-7' };

type Props = {
  readonly label: string;
  readonly tooltip?: string;
  readonly isOpen: boolean;
  readonly size?: MenuTriggerSize;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly children: ReactNode;
};

export const MenuTriggerButton = ({
  label,
  tooltip,
  isOpen,
  size = 'compact',
  disabled = false,
  className,
  onClick,
  children,
}: Props) => (
  <Tooltip content={tooltip ?? DEFAULT_TOOLTIP} anchorClassName="shrink-0" isSuppressed={isOpen}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      data-size={size}
      className={cn(
        'shrink-0 motion-safe:transition-colors',
        'inline-flex items-center justify-center rounded-md',
        FOCUS_RING,
        TRIGGER_SIZE[size],
        disabled
          ? 'cursor-not-allowed text-faint-foreground'
          : 'text-faint-foreground hover:bg-hover hover:text-foreground',
        isOpen && 'bg-selected text-foreground',
        className,
      )}
    >
      {children}
    </button>
  </Tooltip>
);
