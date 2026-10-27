import { useEffect, useRef } from 'react';
import { useAppStore, useCurrentWorkspace } from '../../../store';
import { useNowSessions } from '../../../shared/hooks/useNowSessions';
import { announce } from '../../../shared/lib/announcer';
import { needsYouReasonOf } from './needsYouReasonOf';
import { needsYouAnnouncement } from './needsYouAnnouncement';

type Seen = {
  readonly workspaceId: string | null;
  readonly ids: ReadonlySet<string>;
};

export const useNeedsYouAnnouncement = (): void => {
  const { needsYou } = useNowSessions({});
  const workspaceId = useCurrentWorkspace()?.id ?? null;
  const seen = useRef<Seen | null>(null);

  useEffect(() => {
    const previous = seen.current;
    seen.current = { workspaceId, ids: new Set(needsYou.map((session) => session.id)) };
    if (previous === null || previous.workspaceId !== workspaceId) {
      return;
    }
    const message = needsYouAnnouncement({
      previousIds: previous.ids,
      sessions: needsYou,
      reasonOf: ({ session }) => needsYouReasonOf({ state: useAppStore.getState(), session }),
    });
    if (message !== null) {
      announce({ message });
    }
  }, [needsYou, workspaceId]);
};
