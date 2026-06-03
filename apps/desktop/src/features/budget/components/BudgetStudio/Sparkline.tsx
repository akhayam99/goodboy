import { formatUsdPrecise } from '@goodboy/ui';

interface Props {
  readonly values: ReadonlyArray<number>;
}

export function Sparkline({ values }: Props) {
  if (values.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-border-soft bg-muted/10 text-2xs text-muted-foreground/70">
        not enough turns to chart
      </div>
    );
  }

  const max = Math.max(...values, 0);
  const w = 100;
  const h = 100;
  const top = 6;
  const step = w / (values.length - 1);
  const y = (v: number) => (max === 0 ? h : h - (v / max) * (h - top));
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`);
  const line = points.join(' ');
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <div className="relative h-24 w-full rounded-lg border border-border-soft bg-muted/10">
      <span className="pointer-events-none absolute right-2 top-1.5 font-mono text-2xs tabular-nums text-muted-foreground">
        {formatUsdPrecise(max)}
      </span>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
      >
        <line
          x1="0"
          y1={top}
          x2={w}
          y2={top}
          stroke="var(--color-border-soft)"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={area} fill="var(--color-primary)" opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
