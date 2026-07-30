import { useCallback } from 'react';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { QuestionCard } from '../../../context/components/QuestionsTab/QuestionCard';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
};

export const InteractiveQuestionCard = ({ question, sessionId }: Props) => {
  const {
    drafts,
    justAnswered,
    toggleSuggestion,
    setCustomAnswer,
    toggleCustomField,
    clearJustAnswered,
  } = useOpenQuestions();
  const dismissOpenQuestion = useAppStore((state) => state.dismissOpenQuestion);
  const draft = drafts[question.id];

  const handleDismiss = useCallback(() => {
    void dismissOpenQuestion(sessionId, question);
  }, [dismissOpenQuestion, sessionId, question]);

  return (
    <QuestionCard
      question={question}
      selectedSuggestions={draft?.selectedSuggestions ?? []}
      customAnswer={draft?.customAnswer ?? ''}
      showCustomField={draft?.showCustomField ?? false}
      justAnswered={justAnswered.includes(question.id)}
      onToggleSuggestion={toggleSuggestion}
      onSetCustomAnswer={setCustomAnswer}
      onToggleCustomField={toggleCustomField}
      onDismiss={handleDismiss}
      onClearJustAnswered={clearJustAnswered}
    />
  );
};
