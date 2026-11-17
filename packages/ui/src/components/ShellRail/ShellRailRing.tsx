import { cn } from '../../cn';
import { tintClasses, type Tone } from '../../tint';

type Props = {
  readonly percent: number | null;
  readonly tone: Tone;
};

const PATH_LENGTH = 100;

export const ShellRailRing = ({ percent, tone }: Props) => {
  const tint = tintClasses(tone);
  return (
    <svg
      aria-hidden
      data-slot="rail-ring"
      viewBox="0 0 32 32"
      className="pointer-events-none absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      <rect
        x={1}
        y={1}
        width={30}
        height={30}
        rx={7}
        fill="none"
        strokeWidth={2}
        className={cn('stroke-current opacity-40', tint.text)}
      />
      {percent === null ? null : (
        <rect
          data-slot="rail-ring-arc"
          x={1}
          y={1}
          width={30}
          height={30}
          rx={7}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          pathLength={PATH_LENGTH}
          strokeDasharray={`${percent} ${PATH_LENGTH}`}
          className={cn('stroke-current', tint.text)}
        />
      )}
    </svg>
  );
};
