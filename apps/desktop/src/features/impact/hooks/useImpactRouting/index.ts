import { useCallback, useEffect, useRef, useState } from 'react';
import type { TurnRoleInsight } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { useAppStore } from '../../../../store';
import { toError } from '../../../../shared/utils/toError';
import { impactWindowStart, type ImpactWindowId } from '../../lib';

export type ImpactRouting = {
  readonly insight: QueryResult<TurnRoleInsight>;
  readonly isLoading: boolean;
  readonly retry: () => void;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly windowId: ImpactWindowId;
  readonly isOpen: boolean;
};

type Answer = {
  readonly key: string;
  readonly result: QueryResult<TurnRoleInsight>;
};

const EMPTY_RESULT: QueryResult<TurnRoleInsight> = { data: null, error: null };

export const useImpactRouting = ({ workspaceId, windowId, isOpen }: Params): ImpactRouting => {
  const key = `${workspaceId}:${windowId}`;
  const cache = useRef(new Map<string, TurnRoleInsight>());
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const readTurnRoleInsight = useAppStore((state) => state.readTurnRoleInsight);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const cached = cache.current.get(key);
    if (cached !== undefined) {
      setAnswer({ key, result: { data: cached, error: null } });
      return;
    }
    let isCurrent = true;
    const isStale = () => !isCurrent;
    readTurnRoleInsight({
      workspaceId,
      sinceMs: impactWindowStart({ windowId, nowMs: Date.now() }),
    }).then(
      (data) => {
        if (isStale()) {
          return;
        }
        cache.current.set(key, data);
        setAnswer({ key, result: { data, error: null } });
      },
      (value: unknown) => {
        if (isStale()) {
          return;
        }
        setAnswer({ key, result: { data: null, error: toError({ value }) } });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [attempt, isOpen, key, readTurnRoleInsight, windowId, workspaceId]);

  const retry = useCallback(() => {
    cache.current.delete(key);
    setAnswer(null);
    setAttempt((current) => current + 1);
  }, [key]);

  const result = answer?.key === key ? answer.result : EMPTY_RESULT;
  return {
    insight: result,
    isLoading: isOpen && result.data === null && result.error === null,
    retry,
  };
};
