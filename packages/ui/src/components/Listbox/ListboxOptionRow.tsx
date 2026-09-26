import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../cn';
import type { ListboxMatch } from './filterOptions';
import { HighlightedLabel } from './HighlightedLabel';

export type ListboxOptionRowProps = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly leading?: ReactNode;
  readonly meta?: ReactNode;
  readonly match?: ListboxMatch;
  readonly isCode?: boolean;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly disabledReason?: string;
  readonly isMultiple?: boolean;
  readonly hasLeadingSlot?: boolean;
  readonly onSelect: () => void;
  readonly onActivate: () => void;
};

const NO_MATCH: ListboxMatch = [];

export const ListboxOptionRow = ({
  id,
  label,
  description,
  leading,
  meta,
  match = NO_MATCH,
  isCode = false,
  isActive,
  isSelected,
  disabledReason,
  isMultiple = false,
  hasLeadingSlot = false,
  onSelect,
  onActivate,
}: ListboxOptionRowProps) => {
  const isDisabled = disabledReason !== undefined;
  const secondLine = isDisabled ? disabledReason : description;
  const hasSecondLine = secondLine !== undefined && secondLine !== '';
  const isEmphasized = isSelected && !isMultiple;

  return (
    <div
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-disabled={isDisabled || undefined}
      data-active={isActive || undefined}
      onMouseMove={() => {
        if (!isActive && !isDisabled) {
          onActivate();
        }
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!isDisabled) {
          onSelect();
        }
      }}
      className={cn(
        'flex min-h-8 w-full min-w-0 shrink-0 gap-2 rounded-sm px-2 text-left',
        hasSecondLine ? 'items-start py-1.5' : 'items-center',
        isDisabled
          ? 'cursor-not-allowed text-disabled-foreground'
          : 'cursor-pointer text-foreground',
        isActive && 'bg-selected',
      )}
    >
      {isMultiple ? (
        <span aria-hidden className="flex size-4 shrink-0 items-center justify-center self-center">
          <span
            className={cn(
              'flex size-3.5 items-center justify-center rounded-sm border',
              isSelected ? 'border-primary bg-primary text-on-tone' : 'border-border bg-background',
            )}
          >
            {isSelected ? <Check size={10} strokeWidth={3} /> : null}
          </span>
        </span>
      ) : null}
      {!isMultiple && hasLeadingSlot ? (
        <span
          aria-hidden
          className={cn(
            'flex size-4 shrink-0 items-center justify-center',
            hasSecondLine && 'mt-0.5',
            isDisabled && 'opacity-50',
          )}
        >
          {leading}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'min-w-0 truncate',
            isCode ? 'text-code' : isEmphasized ? 'text-row' : 'text-body',
          )}
        >
          <HighlightedLabel label={label} match={match} />
        </span>
        {hasSecondLine ? (
          <span
            className={cn(
              'min-w-0 truncate text-secondary',
              isDisabled ? 'text-disabled-foreground' : 'text-faint-foreground',
            )}
          >
            {secondLine}
          </span>
        ) : null}
      </span>
      {meta !== undefined ? (
        <span
          className={cn(
            'shrink-0 text-secondary tabular-nums text-faint-foreground',
            hasSecondLine && 'mt-0.5',
          )}
        >
          {meta}
        </span>
      ) : null}
      {isEmphasized ? (
        <Check
          size={14}
          aria-hidden
          className={cn('shrink-0 text-foreground', hasSecondLine && 'mt-0.5')}
        />
      ) : null}
    </div>
  );
};
