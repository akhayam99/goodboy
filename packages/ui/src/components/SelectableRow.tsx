import { OptionalTooltip } from './OptionalTooltip';
import type { TooltipSide } from './Tooltip';
import type { AriaAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { ROW_INTERACTIVE } from '../rowInteractive';
import { SELECTED_ROW_CLASSES } from '../selectedRow';
import { selectedIconClass } from '../selectedIcon';
import type { Tone } from '../tint';

export type SelectableRowProps = {
  readonly selected: boolean;
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly ariaCurrent?: AriaAttributes['aria-current'];
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly shortcut?: string;
  readonly tooltipSide?: TooltipSide;
  readonly isPressed?: boolean;
  readonly testId?: string;
  readonly id?: string;
  readonly role?: 'option';
  readonly ariaSelected?: boolean;
  readonly isExpanded?: boolean;
  readonly tabIndex?: number;
  readonly className?: string;
  readonly selectedIconTone?: Tone;
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
  shortcut,
  tooltipSide,
  isPressed,
  testId,
  id,
  role,
  ariaSelected,
  isExpanded,
  tabIndex,
  className,
  selectedIconTone,
}: SelectableRowProps) => {
  return (
    <OptionalTooltip content={title} shortcut={shortcut} side={tooltipSide}>
      <button
        type="button"
        id={id}
        data-testid={testId}
        data-selected={selected}
        aria-current={ariaCurrent}
        aria-pressed={isPressed}
        aria-label={ariaLabel}
        role={role}
        aria-selected={ariaSelected}
        aria-expanded={isExpanded}
        tabIndex={tabIndex}
        onClick={onClick}
        className={cn(
          ROW_CLASSES,
          selected &&
            selectedIconTone !== undefined &&
            selectedIconClass({ tone: selectedIconTone }),
          className,
        )}
      >
        {children}
      </button>
    </OptionalTooltip>
  );
};
