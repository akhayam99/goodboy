import { StatusDot } from '@goodboy/ui';

export const ToolWaitingRing = () => (
  <span
    aria-hidden
    data-testid="tool-waiting"
    className="pointer-events-none absolute left-1 top-1 flex"
  >
    <StatusDot tone="neutral" size="sm" isRing />
  </span>
);
