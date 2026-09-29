import { StatusDot, Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { ChatSessionMarker } from '../../hooks/useChatSessionMarker';

type Props = {
  readonly marker: ChatSessionMarker;
};

const tooltipOf = ({ marker }: Props) => {
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

export const ChatSessionMark = ({ marker }: Props) => (
  <Tooltip content={tooltipOf({ marker })} anchorClassName="shrink-0">
    <span className="pointer-events-auto flex shrink-0 items-center gap-1">
      <CONCEPT_ICONS.sessions size={11} aria-hidden />
      <StatusDot tone={marker.tone} size="sm" pulsing={marker.isPulsing} />
      <span>{marker.count === 1 ? 'session' : `${marker.count} sessions`}</span>
    </span>
  </Tooltip>
);
