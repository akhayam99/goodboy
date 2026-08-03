import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { closedThreadIds } from '../../closedThreadIds';

type Params = {
  readonly sessionId: SessionId;
};

export const useClosedThreadIds = ({ sessionId }: Params): ReadonlySet<string> =>
  useAppStore(
    useShallow((s) =>
      closedThreadIds({
        comments: s.sessionGithub[sessionId]?.detail?.comments ?? [],
        ledger: s.sessionResolvedThreads[sessionId] ?? [],
      }),
    ),
  );
