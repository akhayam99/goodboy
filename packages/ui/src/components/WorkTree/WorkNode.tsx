import { cn } from '../../cn';
import { tintClasses, type Tone } from '../../tint';
import { WorkNodeArc } from './WorkNodeArc';
import { WorkNodeCenter } from './WorkNodeCenter';
import {
  WORK_NODE_GLYPH_SIZE_FOR,
  WORK_NODE_RING,
  WORK_NODE_SCALE_FOR,
  WORK_NODE_SIZE_FOR,
  type WorkNodeMark,
  type WorkNodeSize,
  type WorkNodeState,
} from './workNodeSpec';

type Props = {
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly label: string;
  readonly tone?: Tone;
  readonly spinClassName?: string;
  readonly hasUnread?: boolean;
  readonly progress?: number | null;
  readonly size?: WorkNodeSize;
};

type RingParams = {
  readonly state: WorkNodeState;
  readonly progress: number | null;
  readonly size: WorkNodeSize;
};

const isArcState = ({ state }: { readonly state: WorkNodeState }): boolean =>
  state === 'running' || state === 'question' || state === 'budget';

const scaleDashArray = (dashArray: string, scale: number): string =>
  dashArray
    .split(' ')
    .map((token) => (Number(token) * scale).toFixed(2))
    .join(' ');

const ringOf = ({ state, progress, size }: RingParams) => {
  if (state === 'marker') {
    return null;
  }
  const nodeSize = WORK_NODE_SIZE_FOR[size];
  const center = nodeSize / 2;
  const scale = WORK_NODE_SCALE_FOR[size];
  if (progress !== null && isArcState({ state })) {
    return <WorkNodeArc progress={progress} isPaused={state !== 'running'} size={size} />;
  }
  const ring = WORK_NODE_RING[state];
  return (
    <svg
      aria-hidden
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
      className="absolute inset-0"
    >
      <circle
        cx={center}
        cy={center}
        r={ring.radius * scale}
        strokeWidth={ring.strokeWidth * scale}
        strokeDasharray={
          ring.dashArray === null ? undefined : scaleDashArray(ring.dashArray, scale)
        }
        className={cn(ring.strokeClassName, ring.fillClassName)}
      />
    </svg>
  );
};

export const WorkNode = ({
  state,
  mark,
  label,
  tone = 'neutral',
  spinClassName = 'spin-border-info',
  hasUnread = false,
  progress = null,
  size = 'md',
}: Props) => {
  const nodeSize = WORK_NODE_SIZE_FOR[size];
  const glyphSize = WORK_NODE_GLYPH_SIZE_FOR[size];
  return (
    <span
      role="img"
      aria-label={hasUnread ? `${label}, unseen` : label}
      data-node-state={state}
      data-node-size={size}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-background',
        state === 'running' && progress === null && cn('spin-border', spinClassName),
        state === 'marker' && cn('ring-1', tintClasses(tone).ring),
      )}
      style={{ width: nodeSize, height: nodeSize }}
    >
      {ringOf({ state, progress, size })}
      <span
        aria-hidden
        data-testid="work-node-glyph"
        className="relative flex size-full items-center justify-center leading-none [&_svg]:block [&_svg]:shrink-0"
      >
        <WorkNodeCenter
          state={state}
          mark={mark}
          hasArc={progress !== null && isArcState({ state })}
          glyphSize={glyphSize}
        />
      </span>
      {hasUnread && (
        <span
          aria-hidden
          className={cn(
            'absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-1 ring-background',
            tintClasses('primary').dot,
          )}
        />
      )}
    </span>
  );
};
