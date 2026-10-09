import { useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { ICON_SIZE } from '../iconSize';
import { tintClasses } from '../tint';
import type { SegmentedTabOption } from './SegmentedTabs';
import { moveTabFocus } from './tabListKeys';

export type ChoiceCardsProps<T extends string = string> = {
  readonly options: ReadonlyArray<SegmentedTabOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly className?: string;
};

export const ChoiceCards = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: ChoiceCardsProps<T>) => {
  const tablistRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      data-variant="card"
      className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3', className)}
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        const mark =
          option.glyph != null ? (
            <span className="flex shrink-0 items-center">{option.glyph}</span>
          ) : Icon != null ? (
            <Icon
              size={ICON_SIZE.control}
              aria-hidden
              className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
            />
          ) : null;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveTabFocus({ event, index, options, tablistRef, onChange })}
            className={cn(
              'relative flex h-16 items-center gap-3 rounded-md px-3 text-left motion-safe:transition-colors',
              FOCUS_RING,
              isActive ? 'bg-selected' : 'hover:bg-hover',
              option.disabled === true && 'cursor-not-allowed opacity-50 hover:bg-transparent',
            )}
          >
            {mark === null ? null : (
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md',
                  isActive ? tintClasses('primary').bgSoft : 'bg-fill',
                )}
              >
                {mark}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-row text-foreground">{option.label}</span>
              {option.hint != null && (
                <span className="truncate text-meta text-muted-foreground">{option.hint}</span>
              )}
            </span>
            {isActive && (
              <Check
                size={ICON_SIZE.row}
                aria-hidden
                className="absolute right-2 top-2 shrink-0 text-primary"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
