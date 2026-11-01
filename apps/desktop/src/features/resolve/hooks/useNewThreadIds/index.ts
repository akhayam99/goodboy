import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { viewerLoginsOf } from '../../../../store/slices/resolve/viewerLogins';
import { newThreadIdsOf } from '../../newThreadIdsOf';
import type { ReviewEntry } from '../../components/ReviewFlow/useReviewEntries';

type Params = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

type Result = {
  readonly newThreadIds: ReadonlySet<string>;
  readonly isLoaded: boolean;
};

const NO_READS: Readonly<Record<string, number>> = {};

export const useNewThreadIds = ({ sessionId, entries }: Params): Result => {
  const reads = useAppStore((s) => s.sessionThreadReads?.[sessionId]);
  const loadThreadReads = useAppStore((s) => s.loadThreadReads);
  const viewerLogins = useAppStore(useShallow((s) => [...viewerLoginsOf({ state: s })].sort()));
  const threadKey = entries.map((entry) => entry.threadId).join('|');
  useEffect(() => {
    void loadThreadReads({ sessionId });
  }, [loadThreadReads, sessionId, threadKey]);
  const newThreadIds = useMemo(
    () =>
      newThreadIdsOf({
        entries: entries.map((entry) => ({
          thread: entry.row.thread,
          commentThread: entry.row.commentThread,
        })),
        reads: reads ?? NO_READS,
        viewerLogins: new Set(viewerLogins),
      }),
    [entries, reads, viewerLogins],
  );
  return { newThreadIds, isLoaded: reads !== undefined };
};
