import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { unreadInputsOf } from '../../../store/slices/thread-reads/unreadInputsOf';
import {
  unreadThreadsOf,
  type UnreadThread,
} from '../../../store/slices/thread-reads/unreadThreadsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
};

type Result = {
  readonly unread: ReadonlyArray<UnreadThread> | null;
  readonly fetchedAtMs: number | null;
};

export const useUnreadThreads = ({ sessionId, mountId = null }: Params): Result => {
  const inputs = useAppStore(useShallow((state) => unreadInputsOf({ state, sessionId, mountId })));
  const loadThreadReads = useAppStore((state) => state.loadThreadReads);
  const threadKey = inputs.threads.map((thread) => thread.threadId).join('|');
  useEffect(() => {
    void loadThreadReads({ sessionId });
  }, [loadThreadReads, sessionId, threadKey]);
  const unread = useMemo(
    () =>
      inputs.comments === null
        ? null
        : unreadThreadsOf({
            threads: inputs.threads,
            comments: inputs.comments,
            entry:
              inputs.entryKind === null
                ? null
                : {
                    kind: inputs.entryKind,
                    projectId: inputs.entryProjectId,
                    number: inputs.entryNumber,
                  },
            reads: inputs.reads,
            viewerLogins:
              inputs.identityKey === null ? null : new Set(inputs.identityKey.split('\n')),
          }),
    [inputs],
  );
  return { unread, fetchedAtMs: inputs.fetchedAtMs };
};
