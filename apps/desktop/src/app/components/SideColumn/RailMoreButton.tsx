import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import { cn } from '@goodboy/ui';
import { RAIL_BUTTON_IDLE, RAIL_NODE_BUTTON } from './RailButton';

type Props = {
  readonly count: number;
  readonly onEnter: (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => void;
  readonly onLeave: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

export const RailMoreButton = ({ count, onEnter, onLeave, onKeyDown }: Props) => (
  <button
    type="button"
    data-rail-more=""
    aria-label={`${count} more pinned ${count === 1 ? 'session' : 'sessions'}`}
    aria-haspopup="dialog"
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    onFocus={onEnter}
    onBlur={onLeave}
    onClick={onEnter}
    onKeyDown={onKeyDown}
    className={cn(RAIL_NODE_BUTTON, 'text-meta tabular-nums', RAIL_BUTTON_IDLE)}
  >
    +{count}
  </button>
);
