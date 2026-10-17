type Props = {
  readonly id?: string;
  readonly used: number;
  readonly limit: number;
  readonly size: number;
};

const STROKE = 1.75;
const NEAR_LIMIT_SHARE = 0.9;

export const LimitRing = ({ id, used, limit, size }: Props) => {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = limit > 0 ? Math.min(used / limit, 1) : 0;
  const isNearLimit = share >= NEAR_LIMIT_SHARE;
  return (
    <span
      id={id}
      role="img"
      aria-label={`${used} of ${limit} characters`}
      data-limit-ring=""
      data-near-limit={isNearLimit ? '' : undefined}
      className="flex shrink-0 self-center"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          stroke="currentColor"
          className="text-border opacity-60"
        />
        {share > 0 ? (
          <circle
            data-limit-ring-fill=""
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={STROKE}
            stroke="currentColor"
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
            className={isNearLimit ? 'text-warning' : 'text-muted-foreground'}
          />
        ) : null}
      </svg>
    </span>
  );
};
