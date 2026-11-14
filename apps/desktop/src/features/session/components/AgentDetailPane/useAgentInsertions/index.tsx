import { useMemo, type ReactNode } from 'react';
import type { Agent, Session } from '@goodboy/types';
import {
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
} from '../../../../../store';
import { isQuestionDelegate } from '../../../../context/questionDelegate';
import type { TranscriptInsertion } from '../../../../../shared/types/transcriptInsertion';
import { AgentAnsweringFor } from '../AgentAnsweringFor';
import { AgentConversationEnd } from '../AgentConversationEnd';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isAutoRoot: boolean;
  readonly autoInsertions: ReadonlyArray<TranscriptInsertion> | undefined;
  readonly runTail: ReactNode | undefined;
};

export const useAgentInsertions = ({
  session,
  agent,
  isAutoRoot,
  autoInsertions,
  runTail,
}: Params): ReadonlyArray<TranscriptInsertion> => {
  const runs = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? null);
  const openQuestions = useSessionOpenQuestions(session.id);
  const answeredQuestions = useSessionAnsweredQuestions(session.id);

  const answeredQuestion = useMemo(() => {
    if (!isQuestionDelegate({ agent })) {
      return null;
    }
    return (
      [...openQuestions, ...answeredQuestions].find(
        (question) => question.id === agent.sourceThreadId,
      ) ?? null
    );
  }, [agent, openQuestions, answeredQuestions]);
  const asker = runs?.find((run) => run.id === agent.parentAgentId) ?? null;

  return useMemo((): ReadonlyArray<TranscriptInsertion> => {
    const leading: ReadonlyArray<TranscriptInsertion> =
      answeredQuestion === null
        ? []
        : [
            {
              key: `answering-for-${agent.id}`,
              beforeMs: 0,
              node: (
                <AgentAnsweringFor
                  sessionId={session.id}
                  question={answeredQuestion}
                  asker={asker}
                />
              ),
            },
          ];
    const hasEnd =
      !isAutoRoot &&
      (agent.status === 'completed' || (runs ?? []).some((run) => run.parentAgentId === agent.id));
    const end: ReadonlyArray<TranscriptInsertion> = hasEnd
      ? [
          {
            key: `conversation-end-${agent.id}`,
            beforeMs: null,
            node: <AgentConversationEnd session={session} agent={agent} />,
          },
        ]
      : [];
    const tail: ReadonlyArray<TranscriptInsertion> =
      runTail === undefined ? [] : [{ key: `run-tail-${agent.id}`, beforeMs: null, node: runTail }];
    return [...leading, ...(autoInsertions ?? []), ...end, ...tail];
  }, [agent, answeredQuestion, asker, autoInsertions, isAutoRoot, runs, session, runTail]);
};
