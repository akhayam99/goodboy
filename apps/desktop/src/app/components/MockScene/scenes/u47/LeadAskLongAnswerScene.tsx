import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { useOpenQuestions } from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import type { C07Seed } from '../u25/c07/c07AutoSeed';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { LEAD_LONG_ANSWER, LEAD_LONG_QUESTION_ID, LEAD_LONG_QUESTIONS } from './leadAskLongSeed';

const WORKING: C07Seed = { state: 'working', place: 'auto' };

export const LeadAskLongAnswerScene = () => {
  const [isSeeded, setIsSeeded] = useState(false);
  useEffect(() => {
    if (isSeeded) {
      return;
    }
    useAppStore.setState({
      sessionOpenQuestions: { [AUTO_SESSION.id]: LEAD_LONG_QUESTIONS },
      loadSessionOpenQuestions: async () => undefined,
    });
    useOpenQuestions.getState().toggleCustomField(LEAD_LONG_QUESTION_ID, 'one');
    useOpenQuestions.getState().setCustomAnswer(LEAD_LONG_QUESTION_ID, LEAD_LONG_ANSWER);
    setIsSeeded(true);
  }, [isSeeded]);
  return <C07AutoFrame seed={WORKING} />;
};
