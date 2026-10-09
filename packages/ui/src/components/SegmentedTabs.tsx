import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { ICON_SIZE } from '../iconSize';
import { tintClasses, type Tone } from '../tint';
import { ChoiceCards } from './ChoiceCards';
import { moveTabFocus } from './tabListKeys';

export type SegmentedTabOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly glyph?: ReactNode;
  readonly hint?: string;
  readonly tooltip?: string;
  readonly badge?: ReactNode;
  readonly disabled?: boolean;
  readonly accent?: string;
  readonly tone?: Tone;
};

export type SegmentedTabsSize = 'xs' | 'sm' | 'md';

export type Props<T extends string = string> = {
  readonly options: ReadonlyArray<SegmentedTabOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly size?: SegmentedTabsSize;
  readonly variant?: 'pill' | 'card';
  readonly ariaLabel: string;
  readonly className?: string;
  readonly fill?: boolean;
};

export const SEGMENTED_FRAME_CLASSES = {
  xs: 'h-7',
  sm: 'h-8',
} as const satisfies Record<'xs' | 'sm', string>;

const TAB_CLASSES = {
  xs: 'h-6 px-2',
  sm: 'h-7 px-3',
} as const satisfies Record<'xs' | 'sm', string>;

const GLYPH = {
  xs: ICON_SIZE.row,
  sm: ICON_SIZE.control,
} as const satisfies Record<'xs' | 'sm', number>;

export const SegmentedTabs = <T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  variant = 'pill',
  ariaLabel,
  className,
  fill = false,
}: Props<T>) => {
  const tablistRef = useRef<HTMLDivElement>(null);

  if (variant === 'card') {
    return (
      <ChoiceCards
        options={options}
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
        className={className}
      />
    );
  }

  const step = size === 'xs' ? 'xs' : 'sm';
  const gridStyle: CSSProperties | undefined = fill
    ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
    : undefined;

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      data-size={step}
      className={cn(
        'gap-0.5 rounded-md border border-border-soft p-px',
        SEGMENTED_FRAME_CLASSES[step],
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
        const mark =
          option.glyph != null ? (
            <span className="flex shrink-0 items-center">{option.glyph}</span>
          ) : Icon != null ? (
            <Icon
              size={GLYPH[step]}
              aria-hidden
              className={cn(
                'shrink-0',
                isActive && option.accent == null && tone != null && tone.icon,
              )}
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
            title={option.tooltip ?? option.hint}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveTabFocus({ event, index, options, tablistRef, onChange })}
            style={activeStyle}
            className={cn(
              'relative flex items-center justify-center gap-2 rounded-sm border border-transparent text-label motion-safe:transition-colors',
              TAB_CLASSES[step],
              FOCUS_RING,
              isActive
                ? 'bg-selected text-foreground'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground',
              option.disabled === true &&
                'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
            )}
          >
            {mark}
            <span className="min-w-0">
              <span className="block truncate">{option.label}</span>
            </span>
            {option.badge != null ? (
              typeof option.badge === 'string' ? (
                <span className="rounded-md bg-fill px-2 py-0.5 text-eyebrow text-muted-foreground">
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
