import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import type { AskButtonFacts } from '../../askButtons';
import { askVerb } from '../../askVerb';
import { askDigestOf } from '../../collectAskPackInput';

type Params = {
  readonly sessionId: SessionId;
};

type FactsParams = Params & {
  readonly state: AppStore;
};

const askActionFactsOf = ({ state, sessionId }: FactsParams): AskButtonFacts => {
  const open = (state.sessionOpenQuestions[sessionId] ?? []).filter(
    (question) => question.status === 'open',
  );
  const agents = (state.sessionPhaseRuns[sessionId] ?? []).filter(
    (agent) => agent.deletedAt == null,
  );
  const canReview =
    askVerb({ state, target: { kind: 'session', sessionId }, actionId: 'session.review' }) !== null;
  const readyCount = canReview
    ? askDigestOf({ state, sessionId, now: Date.now() }).commentWords.filter(
        (word) => word === 'to_review',
      ).length
    : 0;
  return {
    openQuestions: open.map((question, index) => ({ id: question.id, number: index + 1 })),
    messageableAgents: agents
      .filter(
        (agent) =>
          askVerb({
            state,
            target: { kind: 'agent', sessionId, agentId: agent.id },
            actionId: 'agent.message',
          }) !== null,
      )
      .map((agent) => ({ id: agent.id, name: agent.name })),
    readyCount,
  };
};

export const useAskActionFacts = ({ sessionId }: Params): AskButtonFacts => {
  const factsKey = useAppStore((state) => JSON.stringify(askActionFactsOf({ state, sessionId })));
  return useMemo((): AskButtonFacts => JSON.parse(factsKey), [factsKey]);
};
