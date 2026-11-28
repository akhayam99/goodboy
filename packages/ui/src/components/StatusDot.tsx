import { OptionalTooltip } from './OptionalTooltip';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type StatusDotProps = {
  readonly tone: Tone;
  readonly color?: string;
  readonly size?: 'sm' | 'md';
  readonly pulsing?: boolean;
  readonly isRing?: boolean;
  readonly role?: 'status' | 'presentation';
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
};

const sizeClasses: Record<'sm' | 'md', string> = {
  sm: 'size-1.5',
  md: 'size-2',
};

export const StatusDot = ({
  tone,
  color,
  size = 'md',
  pulsing,
  isRing = false,
  role = 'presentation',
  title,
  ariaLabel,
  className,
}: StatusDotProps) => {
  const dot = color === undefined ? tintClasses(tone).dot : '';
  const dim = sizeClasses[size];
  const ariaProps =
    ariaLabel != null
      ? { role: role === 'presentation' ? ('img' as const) : role, 'aria-label': ariaLabel }
      : role === 'presentation'
        ? { role, 'aria-hidden': true }
        : { role };

  return (
    <OptionalTooltip content={title}>
      <span
        className={cn(
          'inline-block shrink-0 rounded-full',
          dim,
          isRing ? 'bg-transparent ring-1 ring-idle ring-inset' : dot,
          pulsing ? 'motion-safe:animate-soft-pulse' : '',
          className,
        )}
        {...(color !== undefined && !isRing && { style: { backgroundColor: color } })}
        {...ariaProps}
      />
    </OptionalTooltip>
  );
};
