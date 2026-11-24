import type { MouseEvent } from 'react';
import { CardAction, CardActionSlot } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { RestoreCardAction } from './RestoreCardAction';
import type { DynamicAction } from './useDynamicActions';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isArchived: boolean;
  readonly action: DynamicAction | null;
  readonly onRestore?: (session: Session) => Promise<void>;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: (event: MouseEvent<HTMLElement>) => void;
};

export const CardQuickActions = ({
  session,
  sessionId,
  isArchived,
  action,
  onRestore,
  onPointerEnter,
  onPointerLeave,
}: Props) => (
  <span
    onMouseEnter={onPointerEnter}
    onMouseLeave={onPointerLeave}
    className="flex shrink-0 items-center gap-1 self-start"
  >
    <CardActionSlot label="Session quick actions">
      {!isArchived && action !== null && (
        <CardAction
          key={action.key}
          icon={action.icon}
          tone={action.tone}
          label={action.label}
          onClick={action.onClick}
        />
      )}
      {isArchived && (
        <RestoreCardAction session={session} sessionId={sessionId} onRestore={onRestore} />
      )}
    </CardActionSlot>
  </span>
);
