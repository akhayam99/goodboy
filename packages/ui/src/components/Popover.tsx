import type { CSSProperties, ReactNode, Ref } from 'react';
import { cn } from '../cn';

export type PopoverProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly innerRef?: Ref<HTMLDivElement>;
};

export const Popover = ({
  children,
  className,
  style,
  role,
  ariaLabel,
  innerRef,
}: PopoverProps) => {
  return (
    <div
      ref={innerRef}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'overflow-hidden rounded-md border border-border bg-muted text-xs shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  );
};
