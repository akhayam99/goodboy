import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../index';
import { autoTreeOfAgent } from '../../../features/auto/autoTreeOfAgent';
import {
  openPermissionAsksOf,
  type OpenPermissionAsk,
} from '../../../features/permissions/openPermissionAsksOf';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export type ConversationPermissionAsk = Readonly<{
  agentId: AgentId;
  item: OpenPermissionAsk;
}>;

export type ConversationAsks = Readonly<{
  permissions: ReadonlyArray<ConversationPermissionAsk>;
  questions: ReadonlyArray<OpenQuestion>;
}>;

const NO_AGENTS: ReadonlyArray<AgentId> = [];

export const useConversationAsks = ({ sessionId, agentId }: Params): ConversationAsks => {
  const views = useAppStore((state) => state.autoTreeViews?.[sessionId] ?? EMPTY_ARRAY);
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions?.[sessionId] ?? EMPTY_ARRAY,
  );
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const askerIds = useMemo((): ReadonlyArray<AgentId> => {
    if (agentId === null) {
      return NO_AGENTS;
    }
    const tree = autoTreeOfAgent({ views, agentId });
    if (tree?.kind !== 'root') {
      return [agentId];
    }
    const children = tree.view.delegations
      .filter((delegation) => !delegation.isAdopted)
      .flatMap((delegation) => (delegation.childAgentId === null ? [] : [delegation.childAgentId]));
    return [...new Set([agentId, ...children])];
  }, [agentId, views]);
  const transcripts = useAppStore(
    useShallow((state) => askerIds.map((id) => state.transcripts[id])),
  );
  const turns = useAppStore(useShallow((state) => askerIds.map((id) => state.agentTurnState[id])));
  const unreadIds = useMemo(
    () =>
      askerIds.filter(
        (_id, index) => turns[index]?.kind === 'blocked' && transcripts[index] === undefined,
      ),
    [askerIds, transcripts, turns],
  );

  useEffect(() => {
    for (const id of unreadIds) {
      void loadAgentTranscript(sessionId, id, { isSelecting: false });
    }
  }, [loadAgentTranscript, sessionId, unreadIds]);

  const permissions = useMemo(
    () =>
      askerIds
        .flatMap((id, index) =>
          openPermissionAsksOf({ events: transcripts[index] ?? [], turnState: turns[index] }).map(
            (item) => ({ agentId: id, item }),
          ),
        )
        .sort((first, second) => first.item.at.localeCompare(second.item.at)),
    [askerIds, transcripts, turns],
  );
  const questions = useMemo(
    () =>
      openQuestions.filter(
        (question) => question.status === 'open' && question.createdByAgentId === agentId,
      ),
    [agentId, openQuestions],
  );

  return useMemo(() => ({ permissions, questions }), [permissions, questions]);
};
