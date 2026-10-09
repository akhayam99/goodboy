import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { tintClasses, type Tone } from '../tint';

export type ChipKind = 'state' | 'reference' | 'id' | 'count';
export type ChipSize = '3xs' | 'xs' | 'sm' | 'md' | 'control';
export type ChipEmphasis = 'subtle' | 'soft' | 'strong';

export type ChipProps = {
  readonly tone: Tone;
  readonly label?: ReactNode;
  readonly icon?: ReactNode;
  readonly trailing?: ReactNode;
  readonly kind?: ChipKind;
  readonly size?: ChipSize;
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly shape?: 'pill' | 'badge';
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
};

export const CHIP_KIND_CLASSES = {
  state: 'h-5 shrink-0 rounded-full px-2 text-chip',
  reference: 'h-6 shrink-0 gap-1 rounded-md px-2 text-meta',
  id: 'h-5 shrink-0 rounded-sm px-1 font-mono text-chip',
  count: 'h-4 min-w-4 shrink-0 justify-center rounded-full px-1 text-chip tabular-nums',
} as const satisfies Record<ChipKind, string>;

const KIND_BY_SIZE = {
  '3xs': 'state',
  xs: 'state',
  sm: 'state',
  md: 'reference',
  control: 'reference',
} as const satisfies Record<ChipSize, ChipKind>;

const widthClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-w-16 justify-center',
  md: 'min-w-24 justify-center',
  lg: 'min-w-32 justify-center',
};

export type ChipClassParams = {
  readonly tone: Tone;
  readonly kind?: ChipKind;
  readonly size?: ChipSize;
  readonly width?: 'auto' | 'sm' | 'md' | 'lg';
  readonly shape?: 'pill' | 'badge';
  readonly bordered?: boolean;
  readonly emphasis?: ChipEmphasis;
  readonly isInteractive?: boolean;
};

const legacyShapeClass = ({ kind, shape }: Pick<ChipClassParams, 'kind' | 'shape'>): string => {
  if (kind !== undefined || shape === undefined) {
    return '';
  }
  return shape === 'pill' ? 'rounded-full' : 'rounded-md';
};

export const chipClasses = ({
  tone,
  kind,
  size = 'xs',
  width = 'auto',
  shape,
  bordered = true,
  emphasis = 'soft',
  isInteractive = false,
}: ChipClassParams): string => {
  const tint = tintClasses(tone);
  return cn(
    'inline-flex items-center gap-1 font-medium',
    emphasis === 'subtle' ? tint.bgSoft : tint.bg,
    tint.text,
    CHIP_KIND_CLASSES[kind ?? KIND_BY_SIZE[size]],
    legacyShapeClass({ kind, shape }),
    width === 'auto' ? '' : widthClasses[width],
    bordered ? 'ring-1' : '',
    bordered ? (emphasis === 'strong' ? tint.ringStrong : tint.ring) : '',
    isInteractive
      ? cn(
          'motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          FOCUS_RING,
          tint.hoverBg,
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
  size = 'xs',
  width = 'auto',
  shape,
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
}: ChipProps) => {
  const isButton = as === 'button' || onClick !== undefined;
  const classes = cn(
    chipClasses({
      tone,
      kind,
      size,
      width,
      shape,
      bordered,
      emphasis,
      isInteractive: isButton,
    }),
    className,
  );

  const inner = (
    <>
      {icon}
      {label}
      {trailing}
    </>
  );

  if (isButton) {
    return (
      <button
        type="button"
        title={title}
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
    );
  }

  return (
    <span
      title={title}
      role={ariaLabel == null ? undefined : 'img'}
      aria-label={ariaLabel}
      data-testid={testId}
      className={classes}
    >
      {inner}
    </span>
  );
};
