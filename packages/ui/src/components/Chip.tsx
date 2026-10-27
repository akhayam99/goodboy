import { OptionalTooltip } from './OptionalTooltip';
import type { FocusEvent, MouseEvent, ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { DISABLED } from '../disabledStyle';
import { FOCUS_RING } from '../focusRing';
import { TEXT_ROLE } from '../textRoles';
import { tintClasses, type Tone } from '../tint';

export type ChipKind = 'state' | 'reference' | 'id' | 'count';
export type ChipEmphasis = 'subtle' | 'soft' | 'strong';

export type ChipProps = {
  readonly tone: Tone;
  readonly label?: ReactNode;
  readonly icon?: ReactNode;
  readonly trailing?: ReactNode;
  readonly kind?: ChipKind;
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly bordered?: boolean;
  readonly emphasis?: ChipEmphasis;
  readonly as?: 'span' | 'button';
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly ariaPressed?: boolean;
  readonly testId?: string;
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly disabled?: boolean;
  readonly expanded?: boolean;
  readonly hasPopup?: 'dialog' | 'menu' | 'listbox' | 'true';
  readonly className?: string;
  readonly ref?: Ref<HTMLElement>;
  readonly onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  readonly onMouseMove?: (event: MouseEvent<HTMLElement>) => void;
  readonly onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  readonly onFocus?: (event: FocusEvent<HTMLElement>) => void;
  readonly onBlur?: (event: FocusEvent<HTMLElement>) => void;
};

export const CHIP_KIND_CLASSES = {
  state: 'h-5 shrink-0 rounded-full px-2 text-chip',
  reference: 'h-6 shrink-0 gap-1 rounded-md px-2 text-meta',
  id: 'h-5 shrink-0 rounded-sm px-1 font-mono text-chip',
  count: 'h-4 min-w-4 shrink-0 justify-center rounded-full px-1 text-chip tabular-nums',
} as const satisfies Record<ChipKind, string>;

const widthClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-w-16 justify-center',
  md: 'min-w-24 justify-center',
  lg: 'min-w-32 justify-center',
};

export type ChipClassParams = {
  readonly tone: Tone;
  readonly kind?: ChipKind;
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly bordered?: boolean;
  readonly emphasis?: ChipEmphasis;
  readonly isInteractive?: boolean;
};

export const chipClasses = ({
  tone,
  kind = 'state',
  width = 'auto',
  bordered = true,
  emphasis = 'soft',
  isInteractive = false,
}: ChipClassParams): string => {
  const tint = tintClasses(tone);
  return cn(
    'inline-flex items-center gap-1 font-medium',
    emphasis === 'subtle' ? tint.bgSoft : tint.bg,
    tone === 'neutral' ? TEXT_ROLE.secondary : tint.text,
    CHIP_KIND_CLASSES[kind],
    width === 'auto' ? '' : widthClasses[width],
    bordered ? 'ring-1' : '',
    bordered ? (emphasis === 'strong' ? tint.ringStrong : tint.ring) : '',
    isInteractive
      ? cn(
          'motion-safe:transition-colors',
          FOCUS_RING,
          bordered ? tint.hoverRing : cn('hover:ring-1', tint.hoverRing),
          tint.hoverText,
        )
      : '',
  );
};

export const Chip = ({
  tone,
  label,
  icon,
  trailing,
  kind,
  width = 'auto',
  bordered = true,
  emphasis = 'soft',
  as = 'span',
  title,
  ariaLabel,
  ariaPressed,
  testId,
  onClick,
  disabled = false,
  expanded,
  hasPopup,
  className,
  ref,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onFocus,
  onBlur,
}: ChipProps) => {
  const isButton = as === 'button' || onClick !== undefined;
  const classes = cn(
    chipClasses({
      tone,
      kind,
      width,
      bordered,
      emphasis,
      isInteractive: isButton,
    }),
    isButton && disabled && DISABLED,
    className,
  );

  const inner = (
    <>
      {icon}
      {label}
      {trailing}
    </>
  );

  const hoverProps = { onMouseEnter, onMouseMove, onMouseLeave, onFocus, onBlur };

  if (isButton) {
    return (
      <OptionalTooltip content={title}>
        <button
          ref={ref as Ref<HTMLButtonElement>}
          {...hoverProps}
          type="button"
          aria-label={ariaLabel}
          aria-pressed={ariaPressed}
          data-testid={testId}
          aria-expanded={expanded}
          aria-haspopup={hasPopup}
          onClick={onClick}
          disabled={disabled}
          className={classes}
        >
          {inner}
        </button>
      </OptionalTooltip>
    );
  }

  return (
    <OptionalTooltip content={title}>
      <span
        ref={ref as Ref<HTMLSpanElement>}
        {...hoverProps}
        role={ariaLabel == null ? undefined : 'img'}
        aria-label={ariaLabel}
        data-testid={testId}
        className={classes}
      >
        {inner}
      </span>
    </OptionalTooltip>
  );
};
