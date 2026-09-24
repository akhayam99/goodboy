import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type StatusDotProps = {
  readonly tone: Tone;
  readonly size?: 'sm' | 'md';
  readonly pulsing?: boolean;
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
  size = 'md',
  pulsing,
  role = 'presentation',
  title,
  ariaLabel,
  className,
}: StatusDotProps) => {
  const dot = tintClasses(tone).dot;
  const dim = sizeClasses[size];
  const ariaProps =
    ariaLabel != null
      ? { role: role === 'presentation' ? ('img' as const) : role, 'aria-label': ariaLabel }
      : role === 'presentation'
        ? { role, 'aria-hidden': true }
        : { role };

  return (
    <span
      title={title}
      className={cn(
        'inline-block shrink-0 rounded-full',
        dim,
        dot,
        pulsing ? 'motion-safe:animate-soft-pulse' : '',
        className,
      )}
      {...ariaProps}
    />
  );
};
