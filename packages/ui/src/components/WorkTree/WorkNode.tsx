import { cn } from '../../cn';
import { tintClasses, type Tone } from '../../tint';
import { WorkNodeCenter } from './WorkNodeCenter';
import {
  WORK_NODE_RING,
  WORK_NODE_SIZE,
  type WorkNodeMark,
  type WorkNodeState,
} from './workNodeSpec';

type Props = {
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly label: string;
  readonly tone?: Tone;
  readonly spinClassName?: string;
  readonly hasUnread?: boolean;
};

const CENTER = WORK_NODE_SIZE / 2;

type RingParams = {
  readonly state: WorkNodeState;
};

const ringOf = ({ state }: RingParams) => {
  if (state === 'marker') {
    return null;
  }
  const ring = WORK_NODE_RING[state];
  return (
    <svg
      aria-hidden
      width={WORK_NODE_SIZE}
      height={WORK_NODE_SIZE}
      viewBox={`0 0 ${WORK_NODE_SIZE} ${WORK_NODE_SIZE}`}
      className="absolute inset-0"
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={ring.radius}
        strokeWidth={ring.strokeWidth}
        strokeDasharray={ring.dashArray ?? undefined}
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
}: Props) => (
  <span
    role="img"
    aria-label={hasUnread ? `${label}, unseen` : label}
    data-node-state={state}
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center rounded-full bg-background',
      state === 'running' && cn('spin-border', spinClassName),
      state === 'marker' && cn('ring-1', tintClasses(tone).ring),
    )}
    style={{ width: WORK_NODE_SIZE, height: WORK_NODE_SIZE }}
  >
    {ringOf({ state })}
    <span aria-hidden className="relative inline-flex items-center justify-center">
      <WorkNodeCenter state={state} mark={mark} />
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
