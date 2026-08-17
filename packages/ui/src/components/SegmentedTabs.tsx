import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type SegmentedTabOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
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
  readonly size?: 'sm' | 'md';
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
  ariaLabel,
  className,
  fill = false,
}: Props<T>) => {
  const tablistRef = useRef<HTMLDivElement>(null);
  const isMedium = size === 'md';
  const gridStyle: CSSProperties | undefined = fill
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
        'gap-1 rounded-lg border border-border-soft bg-subtle p-1',
        fill ? 'grid w-full' : 'inline-flex items-center',
        className,
      )}
      style={gridStyle}
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        const tone = option.tone != null ? tintClasses(option.tone) : null;
        const activeStyle: CSSProperties | undefined =
          isActive && option.accent != null
            ? { color: option.accent, borderColor: option.accent }
            : undefined;
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
              'relative flex items-center justify-center gap-1.5 rounded-md border border-transparent font-medium motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
              isMedium ? 'px-3 py-2 text-sm font-semibold' : 'px-2.5 py-1 text-xs',
              isActive
                ? cn(
                    'bg-elevated font-semibold text-foreground ring-1 ring-inset',
                    option.accent != null || tone == null ? 'ring-border' : tone.ring,
                  )
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
              option.disabled === true &&
                'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
            )}
          >
            {Icon != null ? (
              isMedium ? (
                <Icon
                  size={15}
                  aria-hidden
                  className={cn(
                    'shrink-0',
                    isActive && option.accent == null && tone != null && tone.icon,
                  )}
                />
              ) : (
                <Icon
                  size={13}
                  aria-hidden
                  className={cn(
                    'shrink-0',
                    isActive && option.accent == null && tone != null && tone.icon,
                  )}
                />
              )
            ) : null}
            <span
              className={cn('min-w-0', isMedium && option.hint != null && 'flex flex-col gap-0.5')}
            >
              <span className="block truncate">{option.label}</span>
              {isMedium && option.hint != null ? (
                <span className="block truncate text-2xs font-normal text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </span>
            {option.badge != null ? (
              typeof option.badge === 'string' ? (
                <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
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
