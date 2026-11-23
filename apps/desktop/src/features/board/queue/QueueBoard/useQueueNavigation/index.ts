import { useMemo } from 'react';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../../store';
import { attentionPlace } from '../../../../session/attentionPlace';
import type { QueueMove } from '../../needsYouOf';
import { queueLandingOf } from '../../queueLandingOf';
import type { RunningRow } from '../../runningGroupsOf';

type MoveParams = {
  readonly move: QueueMove;
};

type RowParams = {
  readonly row: RunningRow;
};

type SessionParams = {
  readonly sessionId: string;
};

export type QueueNavigation = Readonly<{
  openLanding: (params: MoveParams) => void;
  openAgent: (params: RowParams) => void;
  openSession: (params: SessionParams) => void;
  openReady: (params: SessionParams) => void;
}>;

export const useQueueNavigation = (): QueueNavigation => {
  const navigate = useAppStore((state) => state.navigate);
  return useMemo(
    () => ({
      openLanding: ({ move }) =>
        navigate({ to: queueLandingOf({ state: useAppStore.getState(), move }) }),
      openAgent: ({ row }) => {
        const sessionId = brandId<SessionId>({ value: row.sessionId });
        navigate({
          to:
            row.agentId === null
              ? sessionPlace({ sessionId })
              : { at: 'agent', sessionId, agentId: brandId<AgentId>({ value: row.agentId }) },
        });
      },
      openSession: ({ sessionId }) =>
        navigate({ to: sessionPlace({ sessionId: brandId<SessionId>({ value: sessionId }) }) }),
      openReady: ({ sessionId }) =>
        navigate({
          to: attentionPlace({
            state: useAppStore.getState(),
            sessionId: brandId<SessionId>({ value: sessionId }),
            reason: 'pr-approved',
          }),
        }),
    }),
    [navigate],
  );
};
