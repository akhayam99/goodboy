import type { CSSProperties, KeyboardEventHandler, ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { FLOATING_SURFACE } from '../floatingSurface';
import { ScrollFade } from './ScrollFade';

export type PopoverProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly innerRef?: Ref<HTMLDivElement>;
  readonly tabIndex?: number;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
};

export type PopoverBodyProps = {
  readonly children: ReactNode;
  readonly className?: string;
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
}: PopoverProps) => {
  return (
    <div
      ref={innerRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      style={style}
      className={cn(
        FLOATING_SURFACE,
        'flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto text-label',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const PopoverBody = ({ children, className }: PopoverBodyProps) => (
  <ScrollFade
    className={cn('flex min-h-0 flex-1 flex-col', className)}
    viewportClassName="h-auto min-h-0 flex-1"
    fadeSize={12}
    fadeFrom="floating"
  >
    {children}
  </ScrollFade>
);
