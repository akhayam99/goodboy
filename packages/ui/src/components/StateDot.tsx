import { StatusDot } from './StatusDot';
import type { Tone } from '../tint';

export type DotState = 'running' | 'needsYou' | 'failed' | 'unread' | 'done' | 'idle';

export type StateDotProps = {
  readonly state: DotState;
  readonly label: string;
  readonly className?: string;
};

const DOT_TONE = {
  running: 'info',
  needsYou: 'warning',
  failed: 'danger',
  unread: 'primary',
  done: 'success',
  idle: 'neutral',
} as const satisfies Record<DotState, Tone>;

export const StateDot = ({ state, label, className }: StateDotProps) => (
  <StatusDot
    tone={DOT_TONE[state]}
    size="sm"
    pulsing={state === 'running'}
    ariaLabel={label}
    title={label}
    className={className}
  />
);
