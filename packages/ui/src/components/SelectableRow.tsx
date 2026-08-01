import type { AriaAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type SelectableRowProps = {
  readonly selected: boolean;
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly ariaCurrent?: AriaAttributes['aria-current'];
  readonly ariaSelected?: boolean;
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly className?: string;
  readonly testId?: string;
};

const ROW_CLASSES =
  'flex w-full rounded-md text-left text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground data-[selected=true]:ring-1 data-[selected=true]:ring-primary/30';

export const SelectableRow = ({
  selected,
  children,
  onClick,
  ariaCurrent,
  ariaSelected,
  ariaLabel,
  title,
  className,
  testId,
}: SelectableRowProps) => {
  return (
    <button
      type="button"
      data-selected={selected}
      data-testid={testId}
      aria-current={ariaCurrent}
      aria-selected={ariaSelected}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      className={cn(ROW_CLASSES, className)}
    >
      {children}
    </button>
  );
};
