import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { autoRunTitleOf } from '../../../autoRunTitleOf';
import type { LeadTreeRootState } from '../../../../auto/tree/leadTreeRootState';
import type { LeadTreeRoot } from '../../LeadTree/leadTreeRoot';

type Params = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly state: LeadTreeRootState | null;
};

export const useRunRailRoot = ({ sessionId, rootAgentId, state }: Params): LeadTreeRoot | null => {
  const title = useAppStore((store) =>
    autoRunTitleOf({ state: store, sessionId, agentId: rootAgentId }),
  );
  return useMemo(
    () =>
      state === null || title === null
        ? null
        : {
            agentId: rootAgentId,
            title,
            node: state.node,
            word: state.word,
          },
    [state, title, rootAgentId],
  );
};
