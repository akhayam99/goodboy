import type { CSSProperties, ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { ScrollFade } from './ScrollFade';

export type PopoverProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly innerRef?: Ref<HTMLDivElement>;
  readonly tabIndex?: number;
};

export type PopoverBodyProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export type PopoverFooterProps = {
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
}: PopoverProps) => {
  return (
    <div
      ref={innerRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      style={style}
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto rounded-md border border-border bg-elevated text-xs shadow-lg',
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
    fadeFrom="elevated"
  >
    {children}
  </ScrollFade>
);

export const PopoverFooter = ({ children, className }: PopoverFooterProps) => (
  <footer className={cn('relative z-10 shrink-0 bg-elevated', className)}>{children}</footer>
);
