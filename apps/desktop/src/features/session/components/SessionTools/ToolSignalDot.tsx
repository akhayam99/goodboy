import { StatusDot } from '@goodboy/ui';
import type { ToolSignal } from './useToolSignal';

type Props = {
  readonly signal: ToolSignal;
};

export const ToolSignalDot = ({ signal }: Props) => (
  <span aria-hidden data-testid="tool-signal" data-signal={signal.kind} className="flex">
    <StatusDot
      tone={signal.kind === 'error' ? 'danger' : 'info'}
      size="sm"
      pulsing={signal.kind === 'running'}
    />
  </span>
);
