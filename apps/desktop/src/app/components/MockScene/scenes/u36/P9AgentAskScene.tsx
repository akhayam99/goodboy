import { useEffect, useState } from 'react';
import { brandId, type OpenQuestion, type OpenQuestionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { C06AgentScene } from '../u25/C06AgentScene';
import { C06_AGENT_ID, C06_SESSION_ID } from '../u25/c06ConversationSeed';

type Props = {
  readonly state: 'permission' | 'finished';
  readonly draft?: string;
  readonly hasQuestions?: boolean;
};

const AT = '2026-11-06T12:30:00.000Z';

type QuestionParams = {
  readonly id: string;
  readonly text: string;
};

const questionOf = ({ id, text }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: C06_SESSION_ID,
  createdByAgentId: C06_AGENT_ID,
  text,
  suggestedAnswers: ['Drop yarn.lock', 'Keep both'],
  recommendedAnswer: 'Drop yarn.lock',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: brandId({ value: AT }),
});

const QUESTIONS: ReadonlyArray<OpenQuestion> = [
  questionOf({ id: 'mock-p9-question-1', text: 'Should the repo keep yarn.lock, or drop it?' }),
  questionOf({ id: 'mock-p9-question-2', text: 'Run the export tests on Node 22 only?' }),
];

export const P9AgentAskScene = ({ state, draft, hasQuestions = false }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  useEffect(() => {
    if (isSeeded) {
      return;
    }
    useAppStore.setState((current) => ({
      agentDraft: {
        ...current.agentDraft,
        ...(draft !== undefined && { [C06_AGENT_ID]: draft }),
      },
      ...(hasQuestions && {
        sessionOpenQuestions: { [C06_SESSION_ID]: QUESTIONS },
        loadSessionOpenQuestions: async () => undefined,
      }),
    }));
    setIsSeeded(true);
  }, [draft, hasQuestions, isSeeded]);
  return <C06AgentScene state={state} />;
};
