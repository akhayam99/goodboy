import { useCallback } from 'react';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { QuestionCard } from '../../../context/components/QuestionsTab/QuestionCard';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { useQuestionDelegateControls } from '../../../context/hooks/useQuestionDelegateControls';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
  readonly askedByName?: string | null;
};

export const InteractiveQuestionCard = ({ question, sessionId, askedByName = null }: Props) => {
  const {
    drafts,
    justAnswered,
    toggleSuggestion,
    setCustomAnswer,
    toggleCustomField,
    clearJustAnswered,
  } = useOpenQuestions();
  const dismissOpenQuestion = useAppStore((state) => state.dismissOpenQuestion);
  const delegate = useQuestionDelegateControls({ sessionId, question });
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
      askedByName={askedByName}
      onToggleSuggestion={toggleSuggestion}
      onSetCustomAnswer={setCustomAnswer}
      onToggleCustomField={toggleCustomField}
      onDismiss={handleDismiss}
      onClearJustAnswered={clearJustAnswered}
      delegateState={delegate.delegateState}
      delegateHints={delegate.delegateHints}
      delegateRouting={delegate.delegateRouting}
      connectedProviders={delegate.connectedProviders}
      onChooseDelegate={delegate.onChooseDelegate}
      onCancelDelegate={delegate.onCancelDelegate}
      onDelegateHints={delegate.onDelegateHints}
      onDelegateRouting={delegate.onDelegateRouting}
    />
  );
};
