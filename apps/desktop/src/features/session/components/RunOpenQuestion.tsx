import { useState } from 'react';
import { Button, Markdown, Notice, formatError } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { PromptField } from '../../../shared/components/PromptField';
import { NAMES } from '../../../shared/utils/names';
import { ORCHESTRATED_COPY } from '../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
};

export const RunOpenQuestion = ({ sessionId, question }: Props) => {
  const answerOpenQuestions = useAppStore((state) => state.answerOpenQuestions);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const canSend = text.trim() !== '' && !isSending;

  const send = async (): Promise<void> => {
    if (!canSend) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await answerOpenQuestions(
        sessionId,
        [{ id: question.id, text: question.text, answer: text.trim() }],
        question.createdByAgentId ?? null,
      );
      setText('');
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      aria-label={ORCHESTRATED_COPY.questionAnswerLabel}
      data-run-open-question={question.id}
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="flex min-w-0 flex-col gap-1 px-2">
        <span className="text-meta text-faint-foreground">{ORCHESTRATED_COPY.questionAsks}</span>
        <Markdown text={question.text} className="text-read text-foreground" />
      </div>
      {error === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={ORCHESTRATED_COPY.blockedAnswerFailed}
          body={error}
          actions={
            <Button size="xs" variant="secondary" disabled={!canSend} onClick={() => void send()}>
              {NAMES.retry}
            </Button>
          }
        />
      )}
      <PromptField
        kind="message"
        label={ORCHESTRATED_COPY.questionAnswerLabel}
        placeholder={ORCHESTRATED_COPY.questionAnswerLabel}
        value={text}
        onChange={setText}
        onSubmit={() => void send()}
        isSubmitBlocked={!canSend}
        disabled={isSending}
        minRows={1}
        maxRows={6}
        actions={
          <Button size="sm" type="submit" disabled={!canSend} isBusy={isSending}>
            {ORCHESTRATED_COPY.questionAnswerAction}
          </Button>
        }
      />
    </form>
  );
};
