import type { MouseEvent } from 'react';
import { cn, FOCUS_RING } from '@goodboy/ui';
import type { BoardSignal } from './boardSignalOf';
import { SignalBody } from './SignalBody';
import { signalPressOf } from './signalPressOf';

type Props = {
  readonly signal: BoardSignal;
  readonly onOpenRequest?: (event: MouseEvent) => void;
  readonly onOpenAttention?: () => void;
  readonly onGlyphEnter?: () => void;
  readonly onGlyphLeave?: (event: MouseEvent<HTMLElement>) => void;
};

export const SessionSignal = ({
  signal,
  onOpenRequest,
  onOpenAttention,
  onGlyphEnter,
  onGlyphLeave,
}: Props) => {
  const press = signalPressOf({ signal, onOpenRequest, onOpenAttention });
  const body = (
    <SignalBody signal={signal} onGlyphEnter={onGlyphEnter} onGlyphLeave={onGlyphLeave} />
  );
  if (press === null) {
    return body;
  }
  return (
    <button
      type="button"
      aria-label={press.label}
      data-board-signal-press=""
      onMouseEnter={signal.kind === 'attention' ? onGlyphEnter : undefined}
      onMouseLeave={signal.kind === 'attention' ? onGlyphLeave : undefined}
      onClick={(event) => {
        event.stopPropagation();
        press.run({ event });
      }}
      className={cn('inline-flex min-w-0 cursor-pointer rounded-sm', FOCUS_RING)}
    >
      {body}
    </button>
  );
};
