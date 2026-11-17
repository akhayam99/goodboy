import type { MouseEvent } from 'react';
import type { BoardSignal } from './boardSignalOf';

type Params = {
  readonly signal: BoardSignal;
  readonly onOpenRequest?: ((event: MouseEvent) => void) | undefined;
  readonly onOpenAttention?: (() => void) | undefined;
};

type PressParams = {
  readonly event: MouseEvent;
};

type SignalPress = Readonly<{
  label: string;
  run: (params: PressParams) => void;
}>;

export const signalPressOf = ({
  signal,
  onOpenRequest,
  onOpenAttention,
}: Params): SignalPress | null => {
  if (signal.kind === 'attention' && onOpenAttention !== undefined) {
    return { label: signal.label, run: onOpenAttention };
  }
  if (signal.kind === 'request' && signal.request.state !== 'none' && onOpenRequest !== undefined) {
    return {
      label: `Open pull request ${signal.request.number ?? ''}`.trim(),
      run: ({ event }) => onOpenRequest(event),
    };
  }
  return null;
};
