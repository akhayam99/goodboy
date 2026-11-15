import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore, useTranscript } from '../../../../../store';
import type { LeadTreeRootState } from '../../../../auto/tree/leadTreeRootState';
import { autoRootTitleOf } from '../../AutoAgentsPane/autoRootTitleOf';
import type { LeadTreeRoot } from '../../LeadTree/leadTreeRoot';

type Params = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly state: LeadTreeRootState | null;
};

export const useRunRailRoot = ({ sessionId, rootAgentId, state }: Params): LeadTreeRoot | null => {
  const name = useAppStore(
    (store) =>
      (store.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === rootAgentId)?.name ??
      null,
  );
  const events = useTranscript(rootAgentId);
  return useMemo(
    () =>
      state === null || name === null
        ? null
        : {
            agentId: rootAgentId,
            title: autoRootTitleOf({ name, ask: state.ask, events }),
            node: state.node,
            word: state.word,
          },
    [state, name, rootAgentId, events],
  );
};
