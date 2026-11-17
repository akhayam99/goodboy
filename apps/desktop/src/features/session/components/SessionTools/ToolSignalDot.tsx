import { StatusDot, type Tone } from '@goodboy/ui';
import type { ToolSignal } from './ToolSignal';
import { TOOL_CORNER_SLOT } from './toolCornerSlot';

const TONE = {
  error: 'danger',
  changed: 'primary',
} as const satisfies Record<ToolSignal['kind'], Tone>;

type Props = {
  readonly signal: ToolSignal;
};

export const ToolSignalDot = ({ signal }: Props) => (
  <span
    aria-hidden
    data-testid="tool-signal"
    data-signal={signal.kind}
    className={TOOL_CORNER_SLOT.end}
  >
    <StatusDot tone={TONE[signal.kind]} size="sm" />
  </span>
);
