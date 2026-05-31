import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Collapsible({ open, onOpenChange, trigger, children, className }: Props) {
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        <span className="flex-1 text-left">{trigger}</span>
        <span
          aria-hidden
          className={cn(
            'text-muted-foreground motion-safe:transition-transform',
            open && 'rotate-90',
          )}
        >
          ›
        </span>
      </button>
      {open ? <div className="px-2 py-1">{children}</div> : null}
    </div>
  );
}
