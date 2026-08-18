import { useEffect, useMemo } from 'react';
import { SectionSurface } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import { OpenQuestionCluster } from '../../../chat/components/ChatView/OpenQuestionCluster';
import { attachedQuestionsFor } from '../../timeline/attachedQuestions';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

export const AgentBriefQuestions = ({ session, agent }: Props) => {
  const questions = useSessionOpenQuestions(session.id);
  const loadSessionOpenQuestions = useAppStore((state) => state.loadSessionOpenQuestions);

  useEffect(() => {
    void loadSessionOpenQuestions(session.id);
  }, [loadSessionOpenQuestions, session.id]);

  const unanswered = useMemo(
    () =>
      attachedQuestionsFor({ questions, agent }).filter((question) => question.status === 'open'),
    [agent, questions],
  );

  if (unanswered.length === 0) {
    return null;
  }

  return (
    <SectionSurface label={unanswered.length === 1 ? 'Open question' : 'Open questions'}>
      <OpenQuestionCluster questions={unanswered} sessionId={session.id} viewerAgentId={agent.id} />
    </SectionSurface>
  );
};
