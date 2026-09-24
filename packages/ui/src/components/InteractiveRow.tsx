import type { ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { SELECTED_ROW_CLASSES } from '../selectedRow';

export type InteractiveRowProps = {
  readonly label: string;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
  readonly children: ReactNode;
  readonly dataAttributes?: Readonly<Record<`data-${string}`, string>>;
  readonly frameClassName?: string;
  readonly className?: string;
};

export const InteractiveRow = ({
  label,
  isSelected,
  onOpen,
  children,
  dataAttributes,
  frameClassName,
  className,
}: InteractiveRowProps) => (
  <div
    data-selected={isSelected}
    className={cn(
      'relative rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground',
      SELECTED_ROW_CLASSES,
      frameClassName,
    )}
  >
    <button
      type="button"
      aria-label={label}
      aria-current={isSelected ? 'true' : undefined}
      onClick={onOpen}
      className={cn('absolute inset-0 cursor-pointer rounded-md', FOCUS_RING)}
      {...dataAttributes}
    />
    <div
      className={cn(
        'pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto',
        className,
      )}
    >
      {children}
    </div>
  </div>
);
