import { Eyebrow } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { RailFlyoutSession } from './RailFlyoutSession';
import { RailPinnedRow } from './RailPinnedRow';

type Props = {
  readonly session: Session | null;
  readonly pinned: ReadonlyArray<Session>;
  readonly currentSessionId: SessionId | null;
  readonly hasStudioOver: boolean;
  readonly onSelectSession: (sessionId: SessionId) => void;
};

export const RailFlyoutBody = ({
  session,
  pinned,
  currentSessionId,
  hasStudioOver,
  onSelectSession,
}: Props) => (
  <>
    {session === null ? null : (
      <RailFlyoutSession session={session} hasStudioOver={hasStudioOver} />
    )}
    {pinned.length === 0 ? null : (
      <div className="flex flex-col" data-slot="rail-flyout-pinned">
        <Eyebrow label="Pinned" muted className="px-2 pt-1" />
        {pinned.map((entry) => (
          <RailPinnedRow
            key={entry.id}
            session={entry}
            isOpen={entry.id === currentSessionId}
            onSelect={() => onSelectSession(entry.id as SessionId)}
          />
        ))}
      </div>
    )}
  </>
);
