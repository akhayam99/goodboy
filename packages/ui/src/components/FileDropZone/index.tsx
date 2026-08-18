import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '../../cn';

export type FileDropZoneProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & {
  readonly actionIcon?: ReactNode;
  readonly actionLabel: string;
  readonly children?: ReactNode;
  readonly isDisabled?: boolean;
  readonly isDragging?: boolean;
  readonly onSelect: () => void;
};

export const FileDropZone = ({
  actionIcon,
  actionLabel,
  children,
  className,
  isDisabled = false,
  isDragging = false,
  onSelect,
  ref,
  ...rest
}: FileDropZoneProps) => (
  <div
    ref={ref}
    className={cn(
      'flex w-full flex-col gap-2 rounded-lg border border-dashed p-2 motion-safe:transition-colors',
      isDragging ? 'border-primary bg-primary/5' : 'border-border-soft',
      className,
    )}
    {...rest}
  >
    {children}
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={cn(
        'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs motion-safe:transition-colors',
        isDisabled
          ? 'cursor-not-allowed text-muted-foreground opacity-50'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {actionIcon}
      {actionLabel}
    </button>
  </div>
);
