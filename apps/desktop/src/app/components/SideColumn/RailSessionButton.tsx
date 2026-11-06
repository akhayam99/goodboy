import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import { cn, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionRowFacts } from '../../../features/workspace/hooks/useSessionRowFacts';
import { StateNode } from '../../../shared/components/StateNode';
import { useObjectMenuTrigger } from '../../../features/actions/useObjectMenuTrigger';
import { RAIL_BUTTON_IDLE, RAIL_NODE_BUTTON, RAIL_NODE_CURRENT } from './RailButton';

export type RailSessionSign = 'current' | 'remembered' | 'none';

type Props = {
  readonly session: Session;
  readonly sign: RailSessionSign;
  readonly hasFlyout: boolean;
  readonly isOpenTail?: boolean;
  readonly onSelect: () => void;
  readonly onEnter?: (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => void;
  readonly onLeave?: () => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

export const RailSessionButton = ({
  session,
  sign,
  hasFlyout,
  isOpenTail = false,
  onSelect,
  onEnter,
  onLeave,
  onKeyDown,
}: Props) => {
  const { summary, node, plainTitle: text, unreadLabel } = useSessionRowFacts({ session });
  const words = summary.words ?? summary.reason;
  const base = words === '' ? text : `${text}, ${words}`;
  const label = unreadLabel === null ? base : `${base}, ${unreadLabel}`;
  const isCurrent = sign === 'current';
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId: session.id },
    anchorKey: `rail-session:${session.id}`,
  });
  const button = (
    <button
      type="button"
      data-rail-session={session.id}
      data-slot={isOpenTail ? 'rail-open-tail' : undefined}
      aria-label={label}
      aria-current={isCurrent ? 'page' : undefined}
      aria-haspopup={hasFlyout ? 'dialog' : undefined}
      onClick={() => {
        if (isCurrent) {
          return;
        }
        onSelect();
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onKeyDown={(event) => {
        menu.onKeyDown(event);
        onKeyDown?.(event);
      }}
      onContextMenu={menu.onContextMenu}
      className={cn(
        RAIL_NODE_BUTTON,
        isCurrent ? RAIL_NODE_CURRENT : RAIL_BUTTON_IDLE,
        sign === 'remembered' && 'text-foreground',
      )}
    >
      <StateNode node={node} isUnreadDot />
    </button>
  );
  if (onEnter !== undefined) {
    return button;
  }
  return (
    <Tooltip content={label} side="right">
      {button}
    </Tooltip>
  );
};
