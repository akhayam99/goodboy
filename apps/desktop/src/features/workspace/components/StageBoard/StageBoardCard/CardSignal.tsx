import type { MouseEvent } from 'react';
import type { BoardSignal } from '../boardSignalOf';
import { SessionSignal } from '../SessionSignal';
import type { DynamicAction } from './useDynamicActions';

type Props = {
  readonly signal: BoardSignal;
  readonly action: DynamicAction | null;
  readonly onOpenRequest: (event: MouseEvent) => void;
  readonly onGlyphEnter: () => void;
  readonly onGlyphLeave: (event: MouseEvent<HTMLElement>) => void;
};

export const CardSignal = ({
  signal,
  action,
  onOpenRequest,
  onGlyphEnter,
  onGlyphLeave,
}: Props) => (
  <span
    data-slot="card-signal"
    className="flex min-w-fit max-w-full flex-1 items-center justify-end"
  >
    <span data-slot="card-signal-reserve" className="inline-flex min-w-14 justify-end">
      <SessionSignal
        signal={signal}
        onOpenRequest={onOpenRequest}
        {...(action !== null && { onOpenAttention: action.onClick })}
        onGlyphEnter={onGlyphEnter}
        onGlyphLeave={onGlyphLeave}
      />
    </span>
  </span>
);
