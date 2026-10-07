import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Tooltip } from './Tooltip';

export type MenuTriggerSize = 'compact' | 'control';

type Props = {
  readonly label: string;
  readonly tooltip?: string;
  readonly isOpen: boolean;
  readonly size?: MenuTriggerSize;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onClick: () => void;
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
  <Tooltip content={tooltip ?? label} anchorClassName="shrink-0">
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
        size === 'control'
          ? 'inline-flex size-7 items-center justify-center rounded-md'
          : 'rounded-sm p-1',
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
