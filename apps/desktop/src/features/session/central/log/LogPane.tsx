import { useDeferredValue, useState } from 'react';
import { CheckCheck } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, Input } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { agentHasUnread } from '../../../../store/slices/agents/agentHasUnread';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { TimelineSkeleton } from '../../components/SessionWorkspace/parts/TimelinePane/TimelineSkeleton';
import { NAMES } from '../../../../shared/utils/names';
import { LogRows } from './LogRows';

const MARK_SEEN_KEY = 'mark-all-seen';

type Props = {
  readonly session: Session;
};

export const LogPane = ({ session }: Props) => {
  const sessionId = session.id;
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const hasUnread = useAppStore((s) =>
    (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).some((agent) => agentHasUnread(agent, false)),
  );
  const pending = usePendingAction({ sessionId });
  const [query, setQuery] = useState('');
  const drawnSessionId = useDeferredValue<SessionId | null>(sessionId, null);

  return (
    <section aria-label="Log entries" className="@container/activity flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          aria-label="Search the log"
          placeholder="Search the log"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {hasUnread ? (
          <Button
            variant="quiet"
            size="sm"
            disabled={pending.pendingKeys.has(MARK_SEEN_KEY)}
            onClick={() =>
              void pending.run({
                key: MARK_SEEN_KEY,
                failureTitle: "Couldn't mark the agents as seen",
                task: () => markAllAgentsSeen(sessionId),
              })
            }
          >
            <CheckCheck size={ICON_SIZE.row} aria-hidden />
            {NAMES.markAsRead}
          </Button>
        ) : null}
      </div>
      {drawnSessionId === sessionId ? (
        <LogRows
          key={sessionId}
          session={session}
          query={query}
          onClearSearch={() => setQuery('')}
        />
      ) : (
        <TimelineSkeleton />
      )}
    </section>
  );
};
