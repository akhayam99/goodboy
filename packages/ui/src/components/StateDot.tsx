import { StatusDot } from './StatusDot';
import type { Tone } from '../tint';

export type DotState = 'running' | 'needsYou' | 'failed' | 'unread' | 'done' | 'idle' | 'stopped';

export type StateDotProps = {
  readonly state: DotState;
  readonly label: string;
  readonly isLive?: boolean;
  readonly className?: string;
};

const DOT_TONE = {
  running: 'info',
  needsYou: 'warning',
  failed: 'danger',
  unread: 'primary',
  done: 'success',
  idle: 'neutral',
  stopped: 'neutral',
} as const satisfies Record<DotState, Tone>;

const RING_STATES: ReadonlySet<DotState> = new Set<DotState>(['idle', 'stopped']);

export const StateDot = ({ state, label, isLive = false, className }: StateDotProps) => (
  <StatusDot
    tone={DOT_TONE[state]}
    size="sm"
    pulsing={isLive && state === 'running'}
    isRing={RING_STATES.has(state)}
    ariaLabel={label}
    title={label}
    className={className}
  />
);
