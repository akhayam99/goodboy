import { formatError } from '@goodboy/ui';
import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import {
  invokePermissionAuditList,
  type RecentDecision,
} from '../../../features/permissions/permissions';

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
  readonly refreshKey?: string;
};

export type RecentDecisions = {
  readonly decisions: ReadonlyArray<RecentDecision>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly retry: () => void;
};

const EMPTY: ReadonlyArray<RecentDecision> = [];

export const useRecentDecisions = ({ sessionIds, refreshKey = '' }: Params): RecentDecisions => {
  const [decisions, setDecisions] = useState<ReadonlyArray<RecentDecision>>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${sessionIds.join('|')}#${refreshKey}`;

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
          setError(formatError(cause));
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
  }, [key, attempt]);

  return { decisions, isLoading, error, retry: () => setAttempt((count) => count + 1) };
};
