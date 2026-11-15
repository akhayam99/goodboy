import { StatusDot } from '@goodboy/ui';
import { TOOL_CORNER_SLOT } from './toolCornerSlot';

export const ToolWaitingRing = () => (
  <span aria-hidden data-testid="tool-waiting" className={TOOL_CORNER_SLOT.start}>
    <StatusDot tone="neutral" size="sm" isRing />
  </span>
);
