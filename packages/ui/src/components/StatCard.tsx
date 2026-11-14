import type { ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
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
  readonly isPressed?: boolean;
  readonly unit?: string;
  readonly valueTone?: Tone;
  readonly className?: string;
};

const valueSizeClasses: Record<'lg' | 'xl', string> = {
  lg: 'text-title',
  xl: 'text-display',
};

const PIN_TO_BOTTOM = 'mt-auto';

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
  isPressed,
  unit,
  valueTone,
  className,
}: StatCardProps) => {
  const tint = tone ? tintClasses(tone) : null;
  const valueClass = cn(
    'tabular-nums',
    valueTone === undefined ? 'text-foreground' : tintClasses(valueTone).text,
    valueSizeClasses[valueSize],
  );
  const valueNode =
    unit === undefined ? (
      <span className={cn(PIN_TO_BOTTOM, valueClass)}>{value}</span>
    ) : (
      <span className={cn(PIN_TO_BOTTOM, 'flex min-w-0 items-baseline gap-2')}>
        <span className={valueClass}>{value}</span>
        <span className="min-w-0 truncate text-ui text-muted-foreground">{unit}</span>
      </span>
    );

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
        {valueNode}
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
        aria-pressed={isPressed}
        className={cn(
          shell,
          'text-left motion-safe:transition-colors hover:bg-hover',
          isPressed === true && 'border-border bg-selected',
          FOCUS_RING,
        )}
      >
        {body}
      </button>
    );
  }

  return <div className={shell}>{body}</div>;
};
