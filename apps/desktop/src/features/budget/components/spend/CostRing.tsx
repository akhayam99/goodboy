import { cn, Eyebrow, tintClasses } from '@goodboy/ui';
import { spendTone } from './lib';

type Props = {
  readonly pct: number;
  readonly centerLabel: string;
  readonly subLabel?: string;
  readonly size?: number;
};

export const CostRing = ({ pct, centerLabel, subLabel, size = 132 }: Props) => {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(Math.max(pct, 0), 1) * c;
  const center = size / 2;
  const tone = spendTone({ pct });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform={`rotate(-90 ${center} ${center})`}
          className={cn('motion-safe:transition-all', tintClasses(tone).text)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-mono text-lg tabular-nums text-foreground">{centerLabel}</span>
        {subLabel !== undefined ? <Eyebrow label={subLabel} /> : null}
      </div>
    </div>
  );
};
