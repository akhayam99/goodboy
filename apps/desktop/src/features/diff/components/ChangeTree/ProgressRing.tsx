import { Check } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly viewed: number;
  readonly total: number;
};

const SIZE = 16;
const STROKE = 1.75;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const ProgressRing = ({ viewed, total }: Props) => {
  const label = `${viewed} of ${total} viewed`;
  if (total > 0 && viewed >= total) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className="flex shrink-0 items-center justify-center rounded-full bg-primary text-on-tone"
        style={{ width: SIZE, height: SIZE }}
      >
        <Check size={ICON_SIZE.mark} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  const share = total === 0 ? 0 : viewed / total;
  return (
    <span role="img" aria-label={label} title={label} className="flex shrink-0">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          stroke="currentColor"
          className="text-border opacity-60"
        />
        {share > 0 ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            stroke="currentColor"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE * share} ${CIRCUMFERENCE}`}
            className="text-primary"
          />
        ) : null}
      </svg>
    </span>
  );
};
