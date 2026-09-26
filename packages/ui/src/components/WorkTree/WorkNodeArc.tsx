import { cn } from '../../cn';
import {
  WORK_NODE_ARC,
  WORK_NODE_SCALE_FOR,
  WORK_NODE_SIZE_FOR,
  type WorkNodeSize,
} from './workNodeSpec';

type Props = {
  readonly progress: number;
  readonly isPaused: boolean;
  readonly size?: WorkNodeSize;
};

export const WorkNodeArc = ({ progress, isPaused, size = 'md' }: Props) => {
  const nodeSize = WORK_NODE_SIZE_FOR[size];
  const center = nodeSize / 2;
  const scale = WORK_NODE_SCALE_FOR[size];
  const radius = WORK_NODE_ARC.radius * scale;
  const strokeWidth = WORK_NODE_ARC.strokeWidth * scale;
  const headRadius = WORK_NODE_ARC.headRadius * scale;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, Math.max(0, progress));
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  return (
    <svg
      aria-hidden
      data-node-arc={isPaused ? 'paused' : 'running'}
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
      className="absolute inset-0"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={strokeWidth}
        className={cn('fill-none', isPaused ? 'stroke-warning/35' : 'stroke-border-soft')}
      />
      {ratio === 0 ? null : (
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          className={cn('fill-none', isPaused ? 'stroke-warning' : 'stroke-info')}
        />
      )}
      {isPaused ? null : (
        <circle
          cx={center + radius * Math.cos(angle)}
          cy={center + radius * Math.sin(angle)}
          r={headRadius}
          className="fill-info motion-safe:animate-soft-pulse"
        />
      )}
    </svg>
  );
};
