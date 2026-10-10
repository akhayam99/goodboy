import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import { Tooltip, cn, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { sessionNodeOf } from '../../../features/workspace/components/SessionActivityBar/sessionNode';
import { SessionStateNode } from '../../../features/workspace/components/SessionActivityBar/SessionStateNode';
import { useSessionSummary } from '../../../features/workspace/hooks/useSessionSummary';
import { sessionRowTitle } from '../../../features/session/sessionTitle';
import { RAIL_BUTTON_IDLE, RAIL_NODE_BUTTON, RAIL_NODE_CURRENT } from './RailButton';

export type RailSessionSign = 'current' | 'remembered' | 'none';

type Props = {
  readonly session: Session;
  readonly sign: RailSessionSign;
  readonly hasFlyout: boolean;
  readonly onSelect: () => void;
  readonly onEnter?: (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => void;
  readonly onLeave?: () => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

export const RailSessionButton = ({
  session,
  sign,
  hasFlyout,
  onSelect,
  onEnter,
  onLeave,
  onKeyDown,
}: Props) => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived: false });
  const { title } = sessionRowTitle({ session, tasks: summary.tasks });
  const text = inlineMarkdownText({ text: title });
  const words = summary.words ?? summary.reason;
  const label = words === '' ? text : `${text}, ${words}`;
  const isCurrent = sign === 'current';
  const button = (
    <button
      type="button"
      data-rail-session={session.id}
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
      onKeyDown={onKeyDown}
      className={cn(
        RAIL_NODE_BUTTON,
        isCurrent ? RAIL_NODE_CURRENT : RAIL_BUTTON_IDLE,
        sign === 'remembered' && 'text-foreground',
      )}
    >
      <SessionStateNode node={node} />
    </button>
  );
  return hasFlyout ? (
    button
  ) : (
    <Tooltip content={label} side="right">
      {button}
    </Tooltip>
  );
};
