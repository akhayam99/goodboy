import { useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { ICON_SIZE } from '../iconSize';
import { tintClasses } from '../tint';
import type { SegmentedTabOption } from './SegmentedTabs';
import { moveTabFocus } from './tabListKeys';

export type ChoiceCardFact = {
  readonly label: string;
  readonly text: string;
};

export type ChoiceCardOption<T extends string = string> = SegmentedTabOption<T> & {
  readonly facts?: ReadonlyArray<ChoiceCardFact>;
};

export type ChoiceCardsProps<T extends string = string> = {
  readonly options: ReadonlyArray<ChoiceCardOption<T>>;
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly isHintWrapped?: boolean;
  readonly className?: string;
};

export const ChoiceCards = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  isHintWrapped = false,
  className,
}: ChoiceCardsProps<T>) => {
  const tablistRef = useRef<HTMLDivElement>(null);
  const focusIndex =
    value === null
      ? Math.max(
          0,
          options.findIndex((option) => option.disabled !== true),
        )
      : options.findIndex((option) => option.value === value);
  const isExplained = value === null && options.some((option) => (option.facts ?? []).length > 0);

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      data-variant={isExplained ? 'explained' : 'card'}
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
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveTabFocus({ event, index, options, tablistRef, onChange })}
            className={cn(
              'relative flex min-h-12 gap-3 rounded-md px-3 py-2 text-left motion-safe:transition-colors',
              isExplained
                ? 'items-start rounded-lg border border-border-soft px-4 py-3 hover:border-border'
                : 'items-center',
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
            <span className={cn('flex min-w-0 flex-col', isExplained && 'gap-1')}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-row text-foreground">{option.label}</span>
                {option.badge}
              </span>
              {option.hint != null && (
                <span
                  className={cn(
                    'text-meta text-muted-foreground',
                    isHintWrapped || isExplained ? 'break-words' : 'truncate',
                  )}
                >
                  {option.hint}
                </span>
              )}
              {isExplained && (option.facts ?? []).length > 0 ? (
                <span className="flex min-w-0 flex-col">
                  {(option.facts ?? []).map((fact) => (
                    <span key={fact.label} className="break-words text-meta">
                      <span className="text-faint-foreground">{fact.label}</span>{' '}
                      <span className="text-muted-foreground">{fact.text}</span>
                    </span>
                  ))}
                </span>
              ) : null}
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
