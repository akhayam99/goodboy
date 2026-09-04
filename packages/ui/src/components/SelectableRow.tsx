import type { AriaAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type SelectableRowProps = {
  readonly selected: boolean;
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly ariaCurrent?: AriaAttributes['aria-current'];
  readonly title?: string;
  readonly role?: 'option';
  readonly ariaSelected?: boolean;
  readonly tabIndex?: number;
  readonly className?: string;
};

const ROW_CLASSES =
  'flex w-full rounded-md text-left text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground data-[selected=true]:bg-primary/10 data-[selected=true]:font-medium data-[selected=true]:text-foreground data-[selected=true]:ring-1 data-[selected=true]:ring-primary/30';

export const SelectableRow = ({
  selected,
  children,
  onClick,
  ariaCurrent,
  title,
  role,
  ariaSelected,
  tabIndex,
  className,
}: SelectableRowProps) => {
  return (
    <button
      type="button"
      data-selected={selected}
      aria-current={ariaCurrent}
      role={role}
      aria-selected={ariaSelected}
      tabIndex={tabIndex}
      title={title}
      onClick={onClick}
      className={cn(ROW_CLASSES, className)}
    >
      {children}
    </button>
  );
};
