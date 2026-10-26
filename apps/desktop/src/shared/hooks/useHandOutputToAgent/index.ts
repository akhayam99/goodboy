import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { useOpenSession } from '../useOpenSession';
import { isLiveSession } from '../../utils/isLiveSession';
import { sessionTitle } from '../../utils/sessionTitle';
import { outputHandoffOf } from '../../utils/outputHandoff';

type HandOffParams = {
  readonly subject: string;
  readonly outcome: string | null;
  readonly projectName: string | null;
  readonly branch: string | null;
  readonly output: string;
};

type Params = {
  readonly sessionId: SessionId | null;
  readonly agentId?: AgentId | null;
};

export type HandOutputToAgent = {
  readonly canHandOff: boolean;
  readonly askLabel: string;
  readonly handOff: (params: HandOffParams) => void;
};

const ASK_AGENT_LABEL = 'Ask the agent about this';

export const NO_OUTPUT_REASON = 'No output yet';

export const useHandOutputToAgent = ({
  sessionId,
  agentId: preferredAgentId = null,
}: Params): HandOutputToAgent => {
  const openSession = useOpenSession();
  const queueOutputHandoff = useAppStore((state) => state.queueOutputHandoff);
  const session = useAppStore((state) =>
    sessionId === null ? undefined : sessionById(state.sessions, sessionId),
  );
  const isOnScreen = useAppStore(
    (state) => sessionId !== null && state.currentSessionId === sessionId,
  );
  const phaseRuns = useAppStore((state) =>
    sessionId === null ? EMPTY_ARRAY : (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const selectedAgentId = useAppStore((state) =>
    sessionId === null ? null : (state.selectedAgentId[sessionId] ?? null),
  );
  const agentId: AgentId | null =
    phaseRuns.find((run) => run.id === preferredAgentId)?.id ??
    (phaseRuns.find((run) => run.id === selectedAgentId) ?? phaseRuns[0])?.id ??
    selectedAgentId;
  const isLive = isLiveSession({ session });
  const canHandOff = sessionId !== null && isLive && agentId !== null;
  const askLabel =
    isOnScreen || session === undefined
      ? ASK_AGENT_LABEL
      : `Ask the agent in ${sessionTitle({ session })} about this`;

  const handOff = useCallback(
    (params: HandOffParams) => {
      if (sessionId === null || agentId === null || !isLive) {
        return;
      }
      queueOutputHandoff({ agentId, handoff: outputHandoffOf(params) });
      if (!isOnScreen) {
        openSession({ sessionId });
      }
    },
    [agentId, isLive, isOnScreen, openSession, queueOutputHandoff, sessionId],
  );

  return { canHandOff, askLabel, handOff };
};
