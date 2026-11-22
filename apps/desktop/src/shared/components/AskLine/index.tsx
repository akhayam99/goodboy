import { useState } from 'react';
import { Chip, ICON_SIZE, IconButton } from '@goodboy/ui';
import { ArrowUp } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../conceptIcons';
import { AskLineAnswer } from './AskLineAnswer';
import type { AskLineAnswerView, AskLineMessageView, AskLineQuestionParams } from './AskLineView';

type Props = {
  readonly starters: ReadonlyArray<string>;
  readonly answer: AskLineAnswerView | null;
  readonly message: AskLineMessageView | null;
  readonly onAsk: (params: AskLineQuestionParams) => void;
  readonly onClose: () => void;
  readonly onOpenInAsk: () => void;
};

const AskIcon = CONCEPT_ICONS.ask;

const ASK_LABEL = 'Ask about this session';

export const AskLine = ({ starters, answer, message, onAsk, onClose, onOpenInAsk }: Props) => {
  const [question, setQuestion] = useState('');
  const isBusy = answer?.phase === 'thinking' || answer?.phase === 'streaming';

  const submit = () => {
    const asked = question.trim();
    if (asked === '' || isBusy) {
      return;
    }
    setQuestion('');
    onAsk({ question: asked });
  };

  return (
    <div data-testid="ask-line" className="flex min-w-0 flex-col gap-2">
      {answer === null ? null : (
        <AskLineAnswer
          view={answer}
          message={message}
          onClose={onClose}
          onOpenInAsk={onOpenInAsk}
          onRetry={() => onAsk({ question: answer.question })}
        />
      )}
      {answer === null && starters.length > 0 ? (
        <div role="group" aria-label="Try asking" className="flex flex-wrap gap-1">
          {starters.map((starter) => (
            <Chip
              key={starter}
              as="button"
              tone="neutral"
              kind="reference"
              label={starter}
              onClick={() => onAsk({ question: starter })}
            />
          ))}
        </div>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex min-h-9 min-w-0 items-center gap-2 rounded-md bg-background px-3 ring-1 ring-inset ring-border-soft focus-within:ring-border"
      >
        <AskIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <input
          value={question}
          aria-label={ASK_LABEL}
          placeholder={ASK_LABEL}
          autoComplete="off"
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-prose text-foreground outline-none placeholder:text-faint-foreground"
        />
        <IconButton
          icon={ArrowUp}
          label="Send question"
          type="submit"
          variant="ghost"
          disabled={question.trim() === '' || isBusy}
        />
      </form>
    </div>
  );
};
