import { useEffect, useState } from 'react';
import { RunOpenQuestion } from '../../../../../features/session/components/RunOpenQuestion';
import { useAppStore } from '../../../../../store';
import { C09_SESSION_ID } from '../u25/c09OrchestratedSeed';
import { seedRunQuestions } from './runQuestionsSeed';

export const RunQuestionsShotScene = () => {
  const [isReady, setIsReady] = useState(false);
  const questions = useAppStore((state) => state.sessionOpenQuestions[C09_SESSION_ID]);
  useEffect(() => {
    seedRunQuestions();
    setIsReady(true);
  }, []);
  if (!isReady || questions === undefined) {
    return null;
  }
  return (
    <div data-shot style={{ width: 680 }} className="flex flex-col bg-background text-foreground">
      <div className="flex flex-col p-6">
        <RunOpenQuestion sessionId={C09_SESSION_ID} questions={questions} />
      </div>
    </div>
  );
};
