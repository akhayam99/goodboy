import { FactCard } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ChatSessionMarker } from '../../hooks/useChatSessionMarker';
import { chatSessionCardOf } from './chatSessionCardOf';

type Props = {
  readonly marker: ChatSessionMarker;
  readonly onOpen: (sessionId: SessionId) => void;
};

export const ChatSessionMark = ({ marker, onOpen }: Props) => {
  const first = marker.entries[0];
  return (
    <FactCard card={chatSessionCardOf({ marker })}>
      <button
        type="button"
        aria-label={first === undefined ? 'Open the session' : `Open the session ${first.title}`}
        onClick={(event) => {
          event.stopPropagation();
          if (first !== undefined) {
            onOpen(first.sessionId);
          }
        }}
        className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <CONCEPT_ICONS.sessions size={ICON_SIZE.mark} aria-hidden />
        {marker.count === 1 ? null : <span className="tabular-nums">{marker.count}</span>}
      </button>
    </FactCard>
  );
};
