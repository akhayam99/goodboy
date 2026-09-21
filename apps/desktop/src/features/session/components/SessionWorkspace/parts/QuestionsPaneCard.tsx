import type {
  OpenQuestion,
  OpenQuestionId,
  OpenQuestionSelectMode,
  SessionId,
} from '@goodboy/types';
import { QuestionCard } from '../../../../context/components/QuestionsTab/QuestionCard';
import { useQuestionDelegateControls } from '../../../../context/hooks/useQuestionDelegateControls';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
  readonly selectedSuggestions: ReadonlyArray<string>;
  readonly customAnswer: string;
  readonly showCustomField: boolean;
  readonly justAnswered: boolean;
  readonly onToggleSuggestion: (
    questionId: OpenQuestionId,
    suggestion: string,
    mode: OpenQuestionSelectMode,
  ) => void;
  readonly onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  readonly onToggleCustomField: (questionId: OpenQuestionId) => void;
  readonly onDismiss: (id: OpenQuestionId) => void;
  readonly onClearJustAnswered: (id: OpenQuestionId) => void;
};

export const QuestionsPaneCard = ({
  question,
  sessionId,
  selectedSuggestions,
  customAnswer,
  showCustomField,
  justAnswered,
  onToggleSuggestion,
  onSetCustomAnswer,
  onToggleCustomField,
  onDismiss,
  onClearJustAnswered,
}: Props) => {
  const delegate = useQuestionDelegateControls({ sessionId, question });

  return (
    <QuestionCard
      question={question}
      selectedSuggestions={selectedSuggestions}
      customAnswer={customAnswer}
      showCustomField={showCustomField}
      justAnswered={justAnswered}
      onToggleSuggestion={onToggleSuggestion}
      onSetCustomAnswer={onSetCustomAnswer}
      onToggleCustomField={onToggleCustomField}
      onDismiss={onDismiss}
      onClearJustAnswered={onClearJustAnswered}
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
