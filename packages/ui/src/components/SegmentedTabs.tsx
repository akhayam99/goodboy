import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type SegmentedTabOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly glyph?: ReactNode;
  readonly hint?: string;
  readonly badge?: ReactNode;
  readonly disabled?: boolean;
  readonly accent?: string;
  readonly tone?: Tone;
};

export type Props<T extends string = string> = {
  readonly options: ReadonlyArray<SegmentedTabOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly size?: 'xs' | 'sm' | 'md';
  readonly variant?: 'pill' | 'card';
  readonly ariaLabel: string;
  readonly className?: string;
  readonly fill?: boolean;
};

type NavigationParams<T extends string> = {
  readonly options: ReadonlyArray<SegmentedTabOption<T>>;
  readonly startIndex: number;
  readonly direction: -1 | 1;
};

type KeyDownParams = {
  readonly event: KeyboardEvent;
  readonly index: number;
};

const nextEnabledIndex = <T extends string>({
  options,
  startIndex,
  direction,
}: NavigationParams<T>): number => {
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (startIndex + direction * offset + options.length) % options.length;
    if (options[index]?.disabled !== true) {
      return index;
    }
  }
  return startIndex;
};

export const SegmentedTabs = <T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'pill',
  ariaLabel,
  className,
  fill = false,
}: Props<T>) => {
  const tablistRef = useRef<HTMLDivElement>(null);
  const isMedium = size === 'md';
  const isCompact = size === 'xs';
  const isCard = variant === 'card';
  const gridStyle: CSSProperties | undefined =
    fill && !isCard
      ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
      : undefined;

  const onKeyDown = ({ event, index }: KeyDownParams) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = nextEnabledIndex({ options, startIndex: index, direction });
    const nextOption = options[nextIndex];
    if (nextOption == null || nextOption.disabled === true || nextIndex === index) {
      return;
    }
    onChange(nextOption.value);
    tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        isCard
          ? 'grid grid-cols-1 gap-2 sm:grid-cols-3'
          : cn(
              'border border-border-soft',
              isCompact ? 'gap-0.5 rounded-md p-0.5' : 'gap-1 rounded-lg p-1',
              fill ? 'grid w-full' : 'inline-flex items-center',
            ),
        className,
      )}
      style={gridStyle}
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        const glyph = option.glyph;
        const tone = option.tone != null ? tintClasses(option.tone) : null;
        const activeStyle: CSSProperties | undefined =
          isActive && option.accent != null
            ? { color: option.accent, borderColor: option.accent }
            : undefined;
        const mark =
          glyph != null ? (
            <span className="flex shrink-0 items-center">{glyph}</span>
          ) : Icon != null ? (
            <Icon
              size={isCard ? 16 : isMedium ? 15 : isCompact ? 12 : 13}
              aria-hidden
              className={cn(
                'shrink-0',
                isCard
                  ? isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                  : isActive && option.accent == null && tone != null && tone.icon,
              )}
            />
          ) : null;
        const hasStackedHint = isMedium && option.hint != null;

        if (isCard) {
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown({ event, index })}
              className={cn(
                'relative flex h-16 items-center gap-2.5 rounded-md border px-3 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                isActive
                  ? cn('bg-selected', tintClasses('primary').border)
                  : 'border-transparent hover:bg-hover',
                option.disabled === true && 'cursor-not-allowed opacity-50 hover:bg-transparent',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md',
                  isActive ? tintClasses('primary').bgSoft : 'bg-fill',
                )}
              >
                {mark}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-row text-foreground">{option.label}</span>
                {option.hint != null && (
                  <span className="truncate text-secondary text-muted-foreground">
                    {option.hint}
                  </span>
                )}
              </span>
              {isActive && (
                <Check
                  size={12}
                  aria-hidden
                  className="absolute right-2 top-2 shrink-0 text-primary"
                />
              )}
            </button>
          );
        }

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={option.disabled}
            title={isMedium ? option.hint : undefined}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown({ event, index })}
            style={activeStyle}
            className={cn(
              'relative flex items-center justify-center gap-1.5 border border-transparent font-medium motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isMedium
                ? 'rounded-md px-3 py-2 text-heading'
                : isCompact
                  ? 'rounded-sm px-2 py-0.5 text-label'
                  : 'rounded-md px-2.5 py-1 text-label',
              isActive
                ? 'bg-selected font-semibold text-foreground'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground',
              option.disabled === true &&
                'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
            )}
          >
            {hasStackedHint ? (
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  {mark}
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="block truncate text-secondary font-normal text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            ) : (
              <>
                {mark}
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                </span>
              </>
            )}
            {option.badge != null ? (
              typeof option.badge === 'string' ? (
                <span className="rounded-md bg-fill px-1.5 py-0.5 text-eyebrow text-muted-foreground">
                  {option.badge}
                </span>
              ) : (
                option.badge
              )
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
