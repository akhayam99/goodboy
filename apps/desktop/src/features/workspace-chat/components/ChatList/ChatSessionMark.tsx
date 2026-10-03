import { StatusDot, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { ChatSessionMarker } from '../../hooks/useChatSessionMarker';

type Props = {
  readonly marker: ChatSessionMarker;
  readonly onOpen: (sessionId: SessionId) => void;
};

type TooltipParams = {
  readonly marker: ChatSessionMarker;
};

const tooltipOf = ({ marker }: TooltipParams) => {
  const only = marker.entries[0];
  if (marker.count === 1 && only !== undefined) {
    return `1 session · ${only.title} · ${only.stageLabel}`;
  }
  return (
    <span className="flex flex-col gap-0.5">
      <span>{pluralize(marker.count, 'session')}</span>
      {marker.entries.map((entry) => (
        <span key={entry.sessionId}>{`${entry.title} · ${entry.stageLabel}`}</span>
      ))}
    </span>
  );
};

export const ChatSessionMark = ({ marker, onOpen }: Props) => {
  const first = marker.entries[0];
  return (
    <Tooltip content={tooltipOf({ marker })} anchorClassName="shrink-0">
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
        <CONCEPT_ICONS.sessions size={11} aria-hidden />
        <StatusDot tone={marker.tone} size="sm" pulsing={marker.isPulsing} />
        <span>{marker.count === 1 ? 'session' : `${marker.count} sessions`}</span>
      </button>
    </Tooltip>
  );
};
