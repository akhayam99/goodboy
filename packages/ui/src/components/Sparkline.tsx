import { formatUsdPrecise } from '../format-cost';

type Props = {
  readonly values: ReadonlyArray<number>;
  readonly formatMaximum?: (maximum: number) => string;
};

export const Sparkline = ({ values, formatMaximum = formatUsdPrecise }: Props) => {
  if (values.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-border-soft bg-muted/10 text-2xs text-muted-foreground/70">
        not enough turns to chart
      </div>
    );
  }

  const maximum = Math.max(...values, 0);
  const width = 100;
  const height = 100;
  const top = 6;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const y = maximum === 0 ? height : height - (value / maximum) * (height - top);
      return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="relative h-24 w-full rounded-lg border border-border-soft bg-muted/10">
      <span className="pointer-events-none absolute right-2 top-1.5 font-mono text-2xs tabular-nums text-muted-foreground">
        {formatMaximum(maximum)}
      </span>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
      >
        <line
          x1="0"
          y1={top}
          x2={width}
          y2={top}
          stroke="var(--color-border-soft)"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={area} fill="var(--color-primary)" opacity={0.12} />
        <polyline
          points={points}
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
};
