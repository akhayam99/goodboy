import { cn } from '../cn';
import { METER_TRACK } from '../meterTrack';
import { tintClasses, type Tone } from '../tint';

export type MeterSize = 'xs' | 'sm';

export type MeterProps = {
  readonly label: string;
  readonly value: number;
  readonly max?: number;
  readonly tone?: Tone;
  readonly size?: MeterSize;
  readonly className?: string;
};

const SIZE_CLASSES = {
  xs: 'h-1',
  sm: 'h-1.5',
} as const satisfies Record<MeterSize, string>;

type PercentParams = {
  readonly value: number;
  readonly max: number;
};

const meterPercent = ({ value, max }: PercentParams): number => {
  if (max <= 0 || Number.isFinite(value) === false) {
    return 0;
  }
  return Math.min(100, Math.max(0, (value / max) * 100));
};

export const Meter = ({
  label,
  value,
  max = 100,
  tone = 'primary',
  size = 'sm',
  className,
}: MeterProps) => (
  <div
    role="meter"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={Math.min(Math.max(value, 0), max)}
    className={cn(METER_TRACK, SIZE_CLASSES[size], className)}
  >
    <div
      data-meter-fill=""
      className={cn('h-full rounded-full', tintClasses(tone).solid)}
      style={{ width: `${meterPercent({ value, max })}%` }}
    />
  </div>
);
