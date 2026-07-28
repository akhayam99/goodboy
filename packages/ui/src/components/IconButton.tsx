import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';

export type IconButtonProps = Omit<ComponentProps<'button'>, 'type' | 'children'> & {
  icon: LucideIcon;
  label: string;
  iconSize?: number;
  busy?: boolean;
  type?: 'button' | 'submit' | 'reset';
};

export const IconButton = ({
  icon: Icon,
  label,
  iconSize = 13,
  busy = false,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) => {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border-soft p-1.5',
        'text-muted-foreground motion-safe:transition-colors',
        'hover:border-border hover:bg-muted/50 hover:text-foreground disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        busy && 'animate-border-pulse',
        className,
      )}
      {...rest}
    >
      <Icon size={iconSize} aria-hidden />
    </button>
  );
};
