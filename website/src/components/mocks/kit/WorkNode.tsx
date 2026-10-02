import type { ReactNode } from 'react';
import './kit.css';
import { Check, Minus, Shield } from '../icons';
import { cx } from './cx';
import {
  MIXED_TONE_STROKE,
  TONE_COLOR,
  WORK_NODE_ARC,
  WORK_NODE_GLYPH_SIZE,
  WORK_NODE_GLYPH_SIZE_SM,
  WORK_NODE_MIXED,
  WORK_NODE_RING,
  WORK_NODE_SIZE,
  WORK_NODE_SIZE_SM,
  workNodeMixedArcs,
  type MixedPart,
  type Tone,
  type WorkNodeState,
} from './spec';

export type WorkNodeMark =
  | { readonly kind: 'index'; readonly value: string }
  | { readonly kind: 'dot' }
  | { readonly kind: 'glyph'; readonly glyph: ReactNode };

export type WorkNodeSize = 'md' | 'sm';

type Props = {
  readonly state: WorkNodeState;
  readonly mark?: WorkNodeMark;
  readonly label: string;
  readonly tone?: Tone;
  readonly spinColor?: string;
  readonly hasUnread?: boolean;
  readonly progress?: number | null;
  readonly size?: WorkNodeSize;
  readonly parts?: ReadonlyArray<MixedPart>;
};

const NO_PARTS: ReadonlyArray<MixedPart> = [];

const NO_MARK: WorkNodeMark = { kind: 'dot' };

const SIZE_FOR: Record<WorkNodeSize, number> = { md: WORK_NODE_SIZE, sm: WORK_NODE_SIZE_SM };

const GLYPH_FOR: Record<WorkNodeSize, number> = {
  md: WORK_NODE_GLYPH_SIZE,
  sm: WORK_NODE_GLYPH_SIZE_SM,
};

const scaleOf = (size: WorkNodeSize): number => SIZE_FOR[size] / WORK_NODE_SIZE;

const scaleDashArray = (dashArray: string, scale: number): string =>
  dashArray
    .split(' ')
    .map((token) => (Number(token) * scale).toFixed(2))
    .join(' ');

const READY_TRIANGLE = 'M 3 1.5 L 9 5 L 3 8.5 Z';

const isArcState = (state: WorkNodeState): boolean =>
  state === 'running' || state === 'question' || state === 'budget';

type MarkParams = {
  readonly mark: WorkNodeMark;
  readonly tone: 'faint' | 'foreground' | 'running';
};

const markOf = ({ mark, tone }: MarkParams) => {
  if (mark.kind === 'glyph') {
    return mark.glyph;
  }
  if (mark.kind === 'index') {
    return (
      <span className={cx('gkNodeIndex', tone === 'faint' && 'gkNodeIndexFaint')}>
        {mark.value}
      </span>
    );
  }
  return <span className={cx('gkNodeDot', tone === 'running' && 'gkNodeDotRunning')} />;
};

const centerOf = ({
  state,
  mark,
  hasArc,
  glyphSize,
}: {
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly hasArc: boolean;
  readonly glyphSize: number;
}) => {
  switch (state) {
    case 'queued':
      return markOf({ mark, tone: 'faint' });
    case 'running':
      return markOf({ mark, tone: hasArc ? 'foreground' : 'running' });
    case 'marker':
    case 'mixed':
      return markOf({ mark, tone: 'foreground' });
    case 'ready':
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" fill="var(--g-warning)" aria-hidden>
          <path d={READY_TRIANGLE} />
        </svg>
      );
    case 'question':
      return <span className="gkNodeSign gkToneWarning">?</span>;
    case 'budget':
      return <span className="gkNodeSign gkToneWarning">$</span>;
    case 'approval':
      return <Shield size={glyphSize} strokeWidth={2.5} className="gkToneWarning" />;
    case 'failed':
      return <span className="gkNodeSign gkToneDanger">!</span>;
    case 'done':
      return <Check size={glyphSize} strokeWidth={2.5} className="gkToneSuccess" />;
    case 'closed':
      return <Check size={glyphSize} strokeWidth={2.5} className="gkToneMuted" />;
    case 'stopped':
      return <span className="gkNodeSquare" />;
    case 'skipped':
      return <Minus size={glyphSize} strokeWidth={2.5} className="gkToneFaint" />;
  }
};

const MixedRing = ({
  parts,
  size,
}: {
  readonly parts: ReadonlyArray<MixedPart>;
  readonly size: WorkNodeSize;
}) => {
  const nodeSize = SIZE_FOR[size];
  const center = nodeSize / 2;
  const scale = scaleOf(size);
  const radius = WORK_NODE_MIXED.radius * scale;
  const circumference = 2 * Math.PI * radius;
  const arcs = workNodeMixedArcs({ parts, radius, gap: WORK_NODE_MIXED.gap * scale });
  return (
    <svg
      aria-hidden
      className="gkNodeRing"
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
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
            fill="none"
            stroke={MIXED_TONE_STROKE[arc.tone]}
            strokeWidth={WORK_NODE_MIXED.strokeWidth * scale}
            strokeDasharray={`${arc.length.toFixed(2)} ${(circumference - arc.length).toFixed(2)}`}
            strokeDashoffset={(-arc.offset).toFixed(2)}
          />
        ))}
      </g>
    </svg>
  );
};

const ArcRing = ({
  progress,
  isPaused,
  size,
}: {
  readonly progress: number;
  readonly isPaused: boolean;
  readonly size: WorkNodeSize;
}) => {
  const nodeSize = SIZE_FOR[size];
  const center = nodeSize / 2;
  const scale = scaleOf(size);
  const radius = WORK_NODE_ARC.radius * scale;
  const strokeWidth = WORK_NODE_ARC.strokeWidth * scale;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, Math.max(0, progress));
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  return (
    <svg
      aria-hidden
      className="gkNodeRing"
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke={
          isPaused
            ? 'color-mix(in oklab, var(--g-warning) 35%, transparent)'
            : 'var(--g-border-soft)'
        }
      />
      {ratio === 0 ? null : (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          stroke={isPaused ? 'var(--g-warning)' : 'var(--g-info)'}
        />
      )}
      {isPaused ? null : (
        <circle
          className="gkSoftPulse"
          cx={center + radius * Math.cos(angle)}
          cy={center + radius * Math.sin(angle)}
          r={WORK_NODE_ARC.headRadius * scale}
          fill="var(--g-info)"
        />
      )}
    </svg>
  );
};

const RingOf = ({
  state,
  progress,
  size,
  parts,
}: {
  readonly state: WorkNodeState;
  readonly progress: number | null;
  readonly size: WorkNodeSize;
  readonly parts: ReadonlyArray<MixedPart>;
}) => {
  if (state === 'marker') {
    return null;
  }
  if (state === 'mixed') {
    return <MixedRing parts={parts} size={size} />;
  }
  if (progress !== null && isArcState(state)) {
    return <ArcRing progress={progress} isPaused={state !== 'running'} size={size} />;
  }
  const nodeSize = SIZE_FOR[size];
  const center = nodeSize / 2;
  const scale = scaleOf(size);
  const ring = WORK_NODE_RING[state];
  return (
    <svg
      aria-hidden
      className="gkNodeRing"
      width={nodeSize}
      height={nodeSize}
      viewBox={`0 0 ${nodeSize} ${nodeSize}`}
    >
      <circle
        cx={center}
        cy={center}
        r={ring.radius * scale}
        fill={ring.fill}
        stroke={ring.stroke}
        strokeWidth={ring.strokeWidth * scale}
        strokeDasharray={
          ring.dashArray === null ? undefined : scaleDashArray(ring.dashArray, scale)
        }
      />
    </svg>
  );
};

export const WorkNode = ({
  state,
  mark = NO_MARK,
  label,
  tone = 'neutral',
  spinColor,
  hasUnread = false,
  progress = null,
  size = 'md',
  parts = NO_PARTS,
}: Props) => {
  const nodeSize = SIZE_FOR[size];
  const hasArc = progress !== null && isArcState(state);
  const style: Record<string, string | number> = { width: nodeSize, height: nodeSize };
  if (spinColor !== undefined) {
    style['--gk-spin-color'] = spinColor;
  }
  if (state === 'marker') {
    style['--gk-marker-ring'] =
      tone === 'neutral'
        ? 'var(--g-border-soft)'
        : `color-mix(in oklab, ${TONE_COLOR[tone]} 20%, transparent)`;
  }
  return (
    <span
      role="img"
      aria-label={hasUnread ? `${label}, unseen` : label}
      data-node-state={state}
      data-node-size={size}
      className={cx(
        'gkNode',
        state === 'running' && progress === null && 'gkNodeSpin',
        state === 'marker' && 'gkNodeMarker',
      )}
      style={style}
    >
      <RingOf state={state} progress={progress} size={size} parts={parts} />
      <span aria-hidden className="gkNodeGlyph">
        {centerOf({ state, mark, hasArc, glyphSize: GLYPH_FOR[size] })}
      </span>
      {hasUnread ? <span aria-hidden className="gkNodeUnread" /> : null}
    </span>
  );
};
