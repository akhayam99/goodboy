import { OptionalTooltip } from './OptionalTooltip';
import type { AriaAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { ROW_INTERACTIVE } from '../rowInteractive';
import { SELECTED_ROW_CLASSES } from '../selectedRow';

export type SelectableRowProps = {
  readonly selected: boolean;
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly ariaCurrent?: AriaAttributes['aria-current'];
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly id?: string;
  readonly role?: 'option';
  readonly ariaSelected?: boolean;
  readonly isExpanded?: boolean;
  readonly tabIndex?: number;
  readonly className?: string;
};

const ROW_CLASSES = cn(
  'flex w-full rounded-md text-left text-muted-foreground hover:text-foreground',
  ROW_INTERACTIVE,
  SELECTED_ROW_CLASSES,
);

export const SelectableRow = ({
  selected,
  children,
  onClick,
  ariaCurrent,
  ariaLabel,
  title,
  id,
  role,
  ariaSelected,
  isExpanded,
  tabIndex,
  className,
}: SelectableRowProps) => {
  return (
    <OptionalTooltip content={title}>
      <button
        type="button"
        id={id}
        data-selected={selected}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
        role={role}
        aria-selected={ariaSelected}
        aria-expanded={isExpanded}
        tabIndex={tabIndex}
        onClick={onClick}
        className={cn(ROW_CLASSES, className)}
      >
        {children}
      </button>
    </OptionalTooltip>
  );
};
