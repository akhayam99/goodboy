import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly icon: ReactNode;
  readonly label: string;
};

export const TriggerButton = ({ active, disabled, onClick, icon, label }: Props) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={cn(
      'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )}
  >
    {icon} {label}
  </button>
);
