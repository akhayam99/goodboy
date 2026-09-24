import type { ReactNode } from 'react';
import { Checkbox, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly ariaLabel: string;
  readonly count: number;
  readonly isChecked: boolean;
  readonly isDisabled?: boolean;
  readonly isChild?: boolean;
  readonly icon?: ReactNode;
  readonly onChange: (next: boolean) => void;
};

export const ActivityFilterOption = ({
  label,
  ariaLabel,
  count,
  isChecked,
  isDisabled = false,
  isChild = false,
  icon = null,
  onChange,
}: Props) => (
  <div className={cn('relative flex min-w-0', isChild && 'pl-5')}>
    {isChild ? (
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-2.5 h-1/2 w-2 rounded-bl-sm border-b border-l border-border"
      />
    ) : null}
    <Checkbox
      checked={isChecked}
      disabled={isDisabled}
      ariaLabel={ariaLabel}
      onChange={onChange}
      className={cn(
        'flex h-7 w-full min-w-0 rounded-md px-1.5 motion-safe:transition-colors',
        isDisabled ? null : 'hover:bg-hover',
      )}
      label={
        <>
          <span
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5',
              isChecked ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {icon}
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0 text-2xs tabular-nums text-faint-foreground">{count}</span>
        </>
      }
    />
  </div>
);
