import type { SessionId } from '@goodboy/types';
import { StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { sessionCreationLabel } from './sessionCreationLabel';

type Props = {
  readonly sessionId: SessionId;
};

export const InFlightActionsStrip = ({ sessionId }: Props) => {
  const creations = useAppStore((state) => state.sessionCreations[sessionId]);
  const inFlight = creations ?? [];

  if (inFlight.length === 0) {
    return null;
  }

  return (
    <ul
      aria-live="polite"
      aria-label="Actions in flight"
      className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle px-3 py-2"
    >
      {inFlight.map((creation) => (
        <li key={creation.id} className="flex items-center gap-2">
          <StatusDot tone="info" size="sm" pulsing />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {sessionCreationLabel({ creation })}
          </span>
        </li>
      ))}
    </ul>
  );
};
