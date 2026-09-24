import { cn } from '../../cn';
import { WORK_NODE_ARC, WORK_NODE_SIZE } from './workNodeSpec';

type Props = {
  readonly progress: number;
  readonly isPaused: boolean;
};

const CENTER = WORK_NODE_SIZE / 2;

const CIRCUMFERENCE = 2 * Math.PI * WORK_NODE_ARC.radius;

export const WorkNodeArc = ({ progress, isPaused }: Props) => {
  const ratio = Math.min(1, Math.max(0, progress));
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  return (
    <svg
      aria-hidden
      data-node-arc={isPaused ? 'paused' : 'running'}
      width={WORK_NODE_SIZE}
      height={WORK_NODE_SIZE}
      viewBox={`0 0 ${WORK_NODE_SIZE} ${WORK_NODE_SIZE}`}
      className="absolute inset-0"
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={WORK_NODE_ARC.radius}
        strokeWidth={WORK_NODE_ARC.strokeWidth}
        className={cn('fill-none', isPaused ? 'stroke-warning/35' : 'stroke-border-soft')}
      />
      {ratio === 0 ? null : (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={WORK_NODE_ARC.radius}
          strokeWidth={WORK_NODE_ARC.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className={cn('fill-none', isPaused ? 'stroke-warning' : 'stroke-info')}
        />
      )}
      {isPaused ? null : (
        <circle
          cx={CENTER + WORK_NODE_ARC.radius * Math.cos(angle)}
          cy={CENTER + WORK_NODE_ARC.radius * Math.sin(angle)}
          r={WORK_NODE_ARC.headRadius}
          className="fill-info motion-safe:animate-soft-pulse"
        />
      )}
    </svg>
  );
};
