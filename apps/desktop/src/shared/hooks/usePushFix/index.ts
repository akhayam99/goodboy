import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  pushFixStateOf,
  type PushFixState,
} from '../../../store/slices/history/pushFix/pushFixStateOf';
import type { PushContinuation } from '../../../store/slices/history/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly onSettled?: PushContinuation['resume'];
};

export const usePushFix = ({ sessionId, mountId, onSettled }: Params): PushFixState => {
  const state = useAppStore(
    useShallow((current) =>
      pushFixStateOf({
        fixes: current.branchPushFixes,
        outcomes: current.pushFixOutcomes,
        agents: current.sessionPhaseRuns[sessionId],
        sessionId,
        mountId,
      }),
    ),
  );
  const latest = useRef(onSettled);

  useEffect(() => {
    latest.current = onSettled;
  }, [onSettled]);

  const unclaimedAgentId = state.kind === 'pushed' && !state.isClaimed ? state.agentId : null;

  useEffect(() => {
    if (unclaimedAgentId === null || latest.current === undefined) {
      return;
    }
    const isClaimed = useAppStore
      .getState()
      .claimPushFixOutcome({ mountId, agentId: unclaimedAgentId });
    if (!isClaimed) {
      return;
    }
    const agentId = unclaimedAgentId;
    void Promise.resolve(latest.current()).then(
      (followUp) => {
        if (followUp !== undefined) {
          useAppStore.getState().notePushFixFollowUp({ mountId, agentId, followUp });
        }
      },
      (error: unknown) =>
        useAppStore
          .getState()
          .reportError({ title: "Couldn't continue after the fix.", error, sessionId }),
    );
  }, [unclaimedAgentId, mountId, sessionId]);

  return state;
};
