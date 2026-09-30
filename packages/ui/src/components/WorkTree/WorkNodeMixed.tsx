import { cn } from '../../cn';
import {
  WORK_NODE_MIXED,
  WORK_NODE_MIXED_STROKE,
  WORK_NODE_SCALE_FOR,
  WORK_NODE_SIZE_FOR,
  workNodeMixedArcs,
  type WorkNodeMixedPart,
  type WorkNodeSize,
} from './workNodeSpec';

type Props = {
  readonly parts: ReadonlyArray<WorkNodeMixedPart>;
  readonly size?: WorkNodeSize;
};

export const WorkNodeMixed = ({ parts, size = 'md' }: Props) => {
  const nodeSize = WORK_NODE_SIZE_FOR[size];
  const center = nodeSize / 2;
  const scale = WORK_NODE_SCALE_FOR[size];
  const radius = WORK_NODE_MIXED.radius * scale;
  const circumference = 2 * Math.PI * radius;
  const arcs = workNodeMixedArcs({ parts, radius, gap: WORK_NODE_MIXED.gap * scale });
  return (
    <svg
      aria-hidden
      data-node-mixed=""
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
      className="absolute inset-0"
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        {arcs.map((arc) => (
          <circle
            key={arc.tone + String(arc.offset)}
            data-arc-tone={arc.tone}
            data-arc-count={arc.count}
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={WORK_NODE_MIXED.strokeWidth * scale}
            strokeDasharray={`${arc.length.toFixed(2)} ${(circumference - arc.length).toFixed(2)}`}
            strokeDashoffset={(-arc.offset).toFixed(2)}
            className={cn('fill-none', WORK_NODE_MIXED_STROKE[arc.tone])}
          />
        ))}
      </g>
    </svg>
  );
};
