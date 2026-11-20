import type { CSSProperties, KeyboardEventHandler, MouseEventHandler, ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { FLOATING_SURFACE } from '../floatingSurface';

export type PopoverProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly innerRef?: Ref<HTMLDivElement>;
  readonly tabIndex?: number;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  readonly onMouseDown?: MouseEventHandler<HTMLDivElement>;
};

export const Popover = ({
  children,
  className,
  style,
  role,
  ariaLabel,
  innerRef,
  tabIndex,
  onKeyDown,
  onMouseDown,
}: PopoverProps) => {
  return (
    <div
      ref={innerRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      style={style}
      className={cn(
        FLOATING_SURFACE,
        'flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto text-meta',
        className,
      )}
    >
      {children}
    </div>
  );
};
