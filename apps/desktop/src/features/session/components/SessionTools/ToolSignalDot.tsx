import { StatusDot, type Tone } from '@goodboy/ui';
import type { ToolSignal } from './useToolSignal';

const TONE = {
  error: 'danger',
  running: 'info',
  changed: 'primary',
} as const satisfies Record<ToolSignal['kind'], Tone>;

type Props = {
  readonly signal: ToolSignal;
};

export const ToolSignalDot = ({ signal }: Props) => (
  <span aria-hidden data-testid="tool-signal" data-signal={signal.kind} className="flex">
    <StatusDot tone={TONE[signal.kind]} size="sm" />
  </span>
);
