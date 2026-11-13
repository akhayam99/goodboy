import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { useOpenSession } from '../useOpenSession';
import { isLiveSession } from '../../utils/isLiveSession';
import { sessionTitle } from '../../utils/sessionTitle';
import { NAMES } from '../../utils/names';
import { outputHandoffOf, type OutputHandoff } from '../../utils/outputHandoff';

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

type QueueParams = {
  readonly agentId: AgentId;
  readonly handoff: OutputHandoff;
};

export type HandOutputToAgent = {
  readonly canHandOff: boolean;
  readonly askLabel: string;
  readonly agentId: AgentId | null;
  readonly agentName: string | null;
  readonly handOff: (params: HandOffParams) => void;
  readonly queue: (params: QueueParams) => boolean;
};

const ASK_AGENT_LABEL = NAMES.sendToTheAgent;

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
      : `${NAMES.sendToTheAgent} in ${sessionTitle({ session })}`;

  const agentName = phaseRuns.find((run) => run.id === agentId)?.name ?? null;

  const queue = useCallback(
    ({ agentId: targetId, handoff }: QueueParams): boolean => {
      const state = useAppStore.getState();
      const run = sessionId === null ? undefined : state.sessionPhaseRuns[sessionId];
      const isTarget = run?.some((candidate) => candidate.id === targetId) === true;
      const isStillLive =
        sessionId !== null && isLiveSession({ session: sessionById(state.sessions, sessionId) });
      if (
        sessionId === null ||
        !isStillLive ||
        (!isTarget && state.selectedAgentId[sessionId] !== targetId)
      ) {
        return false;
      }
      queueOutputHandoff({ agentId: targetId, handoff });
      if (state.currentSessionId !== sessionId) {
        openSession({ sessionId });
      }
      return true;
    },
    [openSession, queueOutputHandoff, sessionId],
  );

  const handOff = useCallback(
    (params: HandOffParams) => {
      if (agentId === null) {
        return;
      }
      queue({ agentId, handoff: outputHandoffOf(params) });
    },
    [agentId, queue],
  );

  return { canHandOff, askLabel, agentId, agentName, handOff, queue };
};
