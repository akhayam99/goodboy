import { Chip } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
};

type AnswerParams = {
  readonly answer: string;
};

export const TimelineQuestionInset = ({ question, sessionId }: Props) => {
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);
  const QuestionIcon = CONCEPT_ICONS.questions;
  const onAnswer = ({ answer }: AnswerParams) => {
    void answerOpenQuestions(
      sessionId,
      [{ id: question.id, text: question.text, answer }],
      question.createdByAgentId ?? null,
    );
  };
  const creatorAgentId = question.createdByAgentId ?? null;

  return (
    <div className="flex flex-col gap-2 border-l-2 border-warning px-3 py-2 text-xs">
      <div className="flex items-start gap-2">
        <QuestionIcon size={14} aria-hidden className="shrink-0 text-warning" />
        <span className="min-w-0 flex-1 leading-relaxed">{question.text}</span>
        {creatorAgentId != null ? (
          <button
            type="button"
            className="text-2xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setActiveLens(sessionId, 'questions');
              requestOpenQuestionScroll({
                agentId: creatorAgentId,
                questionId: question.id,
              });
            }}
          >
            Open in Questions
          </button>
        ) : null}
      </div>
      {question.suggestedAnswers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {question.suggestedAnswers.map((answer) => (
            <Chip
              key={answer}
              as="button"
              tone={answer === question.recommendedAnswer ? 'warning' : 'neutral'}
              label={answer}
              onClick={() => onAnswer({ answer })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
