import { Button, Input } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { answerChoicesOf } from '../answerChoicesOf';
import { useQueueSends } from './useQueueSends';

type AnswerParams = {
  readonly text: string;
};

type Props = {
  readonly question: OpenQuestion;
  readonly onAnswer: (params: AnswerParams) => void;
};

const SEND = 'Send answer';

export const MoveAnswer = ({ question, onAnswer }: Props) => {
  const draft = useQueueSends((state) => state.answerDrafts[question.id] ?? '');
  const setAnswerDraft = useQueueSends((state) => state.setAnswerDraft);
  const choices = answerChoicesOf({ question });
  if (choices.length > 0) {
    const [preferred] = choices;
    return (
      <div data-move-answer="choices" className="flex min-w-0 flex-wrap items-center gap-2">
        {choices.map((choice, index) => {
          const look = actionButtonLookOf({
            verb: choice,
            variant: choice === preferred ? 'primary' : 'secondary',
          });
          return (
            <Button
              key={choice}
              size="sm"
              variant={look.variant}
              intent={look.intent}
              data-answer-index={index + 1}
              data-answer-preferred={choice === preferred ? '' : undefined}
              onClick={() => onAnswer({ text: choice })}
            >
              {choice}
            </Button>
          );
        })}
      </div>
    );
  }
  const look = actionButtonLookOf({ verb: SEND, variant: 'primary' });
  const send = () => {
    if (draft.trim() === '') {
      return;
    }
    onAnswer({ text: draft });
    setAnswerDraft({ questionId: question.id, text: '' });
  };
  return (
    <div data-move-answer="text" className="flex min-w-0 items-center gap-2">
      <Input
        aria-label={question.text}
        value={draft}
        placeholder="Answer"
        onChange={(event) => setAnswerDraft({ questionId: question.id, text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <Button
        size="sm"
        variant={look.variant}
        intent={look.intent}
        data-answer-preferred=""
        disabled={draft.trim() === ''}
        onClick={send}
      >
        {SEND}
      </Button>
    </div>
  );
};
