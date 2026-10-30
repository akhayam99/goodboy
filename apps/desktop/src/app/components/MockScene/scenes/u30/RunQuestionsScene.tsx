import { useEffect } from 'react';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';
import { seedRunQuestions } from './runQuestionsSeed';

export const RunQuestionsScene = () => {
  useEffect(() => {
    seedRunQuestions();
  }, []);

  return <C09OrchestratedScene state="needs-answer" page="document" />;
};
