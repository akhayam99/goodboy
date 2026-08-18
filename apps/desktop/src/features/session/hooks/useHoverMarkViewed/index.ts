import { useCallback, useEffect, useRef } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const HOVER_DWELL_MS = 450;

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly hasUnread: boolean;
};

type Handlers = {
  readonly onMouseEnter: (() => void) | undefined;
  readonly onMouseLeave: (() => void) | undefined;
};

export const useHoverMarkViewed = ({ sessionId, agentId, hasUnread }: Params): Handlers => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    if (timerRef.current != null || agentId == null) {
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void useAppStore.getState().markAgentSeen(sessionId, agentId);
    }, HOVER_DWELL_MS);
  }, [agentId, sessionId]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current == null) {
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current == null) {
        return;
      }
      clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    onMouseEnter: hasUnread && agentId != null ? onMouseEnter : undefined,
    onMouseLeave: hasUnread && agentId != null ? onMouseLeave : undefined,
  };
};
