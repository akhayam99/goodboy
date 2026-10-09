import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';
import { Eyebrow } from './Eyebrow';

export type StatCardProps = {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
  readonly icon?: ReactNode;
  readonly tone?: Tone;
  readonly alert?: boolean;
  readonly valueSize?: 'lg' | 'xl';
  readonly status?: ReactNode;
  readonly reservesDeltaRow?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
};

const valueSizeClasses: Record<'lg' | 'xl', string> = {
  lg: 'text-title',
  xl: 'text-display',
};

const warningTint = tintClasses('warning');

export const StatCard = ({
  value,
  label,
  hint,
  icon,
  tone,
  alert,
  valueSize = 'xl',
  status,
  reservesDeltaRow = false,
  onClick,
  className,
}: StatCardProps) => {
  const tint = tone ? tintClasses(tone) : null;

  const body = (
    <>
      {icon && tint ? (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
            tint.bg,
            tint.ring,
            tint.icon,
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div data-stat-label="" className="min-w-0">
          <Eyebrow label={label} className="line-clamp-2" />
        </div>
        <span
          className={cn(
            'mt-auto font-mono tabular-nums text-foreground',
            valueSizeClasses[valueSize],
          )}
        >
          {value}
        </span>
        {hint || status || reservesDeltaRow ? (
          <div
            data-stat-delta=""
            className={cn(
              'flex flex-wrap items-center gap-x-2 text-meta text-faint-foreground',
              reservesDeltaRow && 'min-h-4',
            )}
          >
            {status ?? null}
            {hint ? <span>{hint}</span> : null}
          </div>
        ) : null}
      </div>
      {onClick ? <ArrowRight size={14} aria-hidden className="text-muted-foreground" /> : null}
    </>
  );

  const shell = cn(
    icon && tint ? 'flex items-start gap-3' : 'flex flex-col gap-1',
    'rounded-lg border bg-subtle px-4 py-3',
    alert ? warningTint.border : 'border-border-soft',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(shell, 'text-left motion-safe:transition-colors hover:bg-hover')}
      >
        {body}
      </button>
    );
  }

  return <div className={shell}>{body}</div>;
};
