import { cn } from '../../cn';
import { tintClasses, type Tone } from '../../tint';
import { WorkNodeArc } from './WorkNodeArc';
import { WorkNodeCenter } from './WorkNodeCenter';
import { WorkNodeMixed } from './WorkNodeMixed';
import {
  WORK_NODE_GLYPH_SIZE_FOR,
  WORK_NODE_QUIET,
  WORK_NODE_QUIET_PAD_CLASS,
  WORK_NODE_QUIET_RING,
  WORK_NODE_QUIET_SOLID_RADIUS,
  WORK_NODE_RING,
  WORK_NODE_SCALE_FOR,
  WORK_NODE_SIZE_FOR,
  type WorkNodeLook,
  type WorkNodeMark,
  type WorkNodeMixedPart,
  type WorkNodeSize,
  type WorkNodeState,
} from './workNodeSpec';

type Props = {
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly label: string;
  readonly tone?: Tone;
  readonly spinClassName?: string;
  readonly isSpinning?: boolean;
  readonly hasUnread?: boolean;
  readonly progress?: number | null;
  readonly size?: WorkNodeSize;
  readonly parts?: ReadonlyArray<WorkNodeMixedPart>;
  readonly isTransparent?: boolean;
  readonly look?: WorkNodeLook;
};

const NO_PARTS: ReadonlyArray<WorkNodeMixedPart> = [];

type RingParams = {
  readonly state: WorkNodeState;
  readonly progress: number | null;
  readonly size: WorkNodeSize;
  readonly parts: ReadonlyArray<WorkNodeMixedPart>;
  readonly look: WorkNodeLook;
};

type QuietRingParams = {
  readonly state: WorkNodeState;
  readonly size: WorkNodeSize;
};

const quietRingOf = ({ state, size }: QuietRingParams) => {
  const spec = WORK_NODE_QUIET[state];
  if (spec === undefined || spec.drawing === 'bare') {
    return null;
  }
  const nodeSize = WORK_NODE_SIZE_FOR[size];
  const center = nodeSize / 2;
  return (
    <svg
      aria-hidden
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
      className="absolute inset-0"
    >
      {spec.drawing === 'solid' ? (
        <circle
          cx={center}
          cy={center}
          r={WORK_NODE_QUIET_SOLID_RADIUS[size]}
          className={cn('stroke-none', spec.fillClassName)}
        />
      ) : (
        <circle
          cx={center}
          cy={center}
          r={WORK_NODE_QUIET_RING.radius}
          strokeWidth={WORK_NODE_QUIET_RING.strokeWidth}
          strokeDasharray={WORK_NODE_QUIET_RING.dashArray}
          className={cn(WORK_NODE_QUIET_RING.strokeClassName, 'fill-none')}
        />
      )}
    </svg>
  );
};

type LookParams = {
  readonly state: WorkNodeState;
  readonly look: WorkNodeLook;
};

const isQuietState = ({ state, look }: LookParams): boolean =>
  look === 'quiet' && WORK_NODE_QUIET[state] !== undefined;

const isArcState = ({ state }: { readonly state: WorkNodeState }): boolean =>
  state === 'running' || state === 'question' || state === 'budget';

const scaleDashArray = (dashArray: string, scale: number): string =>
  dashArray
    .split(' ')
    .map((token) => (Number(token) * scale).toFixed(2))
    .join(' ');

const ringOf = ({ state, progress, size, parts, look }: RingParams) => {
  if (state === 'marker') {
    return null;
  }
  if (isQuietState({ state, look })) {
    return quietRingOf({ state, size });
  }
  if (state === 'mixed') {
    return <WorkNodeMixed parts={parts} size={size} />;
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
  isSpinning = false,
  hasUnread = false,
  progress = null,
  size = 'md',
  parts = NO_PARTS,
  isTransparent = false,
  look = 'ring',
}: Props) => {
  const nodeSize = WORK_NODE_SIZE_FOR[size];
  const glyphSize = WORK_NODE_GLYPH_SIZE_FOR[size];
  const isQuietPad = look === 'quiet' && state === 'marker' && tone === 'neutral';
  return (
    <span
      role="img"
      aria-label={hasUnread ? `${label}, unseen` : label}
      data-node-state={state}
      data-node-size={size}
      data-node-look={look}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        isTransparent ? 'bg-transparent' : 'bg-background',
        (isSpinning || (state === 'running' && progress === null)) &&
          cn('spin-border', spinClassName),
        state === 'marker' && !isQuietPad && cn('ring-1', tintClasses(tone).ring),
      )}
      style={{ width: nodeSize, height: nodeSize }}
    >
      {isQuietPad && (
        <span
          aria-hidden
          className={cn('absolute inset-0 rounded-full', WORK_NODE_QUIET_PAD_CLASS)}
        />
      )}
      {ringOf({ state, progress, size, parts, look })}
      <span
        aria-hidden
        data-testid="work-node-glyph"
        className="relative flex size-full items-center justify-center leading-none [&_svg]:block [&_svg]:shrink-0"
      >
        <WorkNodeCenter
          state={state}
          mark={mark}
          hasArc={progress !== null && isArcState({ state }) && !isQuietState({ state, look })}
          glyphSize={glyphSize}
          look={look}
        />
      </span>
      {hasUnread && (
        <span
          aria-hidden
          className={cn(
            'absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-1 ring-background',
            tintClasses('unread').dot,
          )}
        />
      )}
    </span>
  );
};
