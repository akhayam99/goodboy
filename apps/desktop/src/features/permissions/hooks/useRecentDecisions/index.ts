import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { invokePermissionAuditList, type RecentDecision } from '../../permissions';

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

export type RecentDecisions = {
  readonly decisions: ReadonlyArray<RecentDecision>;
  readonly isLoading: boolean;
  readonly error: string | null;
};

const EMPTY: ReadonlyArray<RecentDecision> = [];

export const useRecentDecisions = ({ sessionIds }: Params): RecentDecisions => {
  const [decisions, setDecisions] = useState<ReadonlyArray<RecentDecision>>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = sessionIds.join('|');

  useEffect(() => {
    let isCancelled = false;
    if (sessionIds.length === 0) {
      setDecisions(EMPTY);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    invokePermissionAuditList({ sessionIds })
      .then((rows) => {
        if (!isCancelled) {
          setDecisions(rows);
        }
      })
      .catch((cause: unknown) => {
        if (!isCancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [key]);

  return { decisions, isLoading, error };
};
