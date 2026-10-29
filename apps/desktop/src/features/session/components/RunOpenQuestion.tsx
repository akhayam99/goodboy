import { useState } from 'react';
import { Button, Markdown, Notice, formatError } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { PromptField } from '../../../shared/components/PromptField';
import { NAMES } from '../../../shared/utils/names';
import { ORCHESTRATED_COPY } from '../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

type TextParams = {
  readonly id: string;
};

export const RunOpenQuestion = ({ sessionId, questions }: Props) => {
  const answerOpenQuestions = useAppStore((state) => state.answerOpenQuestions);
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const first = questions[0];
  const isMany = questions.length > 1;
  const textOf = ({ id }: TextParams): string => answers[id] ?? '';
  const canSend =
    questions.every((question) => textOf({ id: question.id }).trim() !== '') && !isSending;

  const send = async (): Promise<void> => {
    if (!canSend || first === undefined) {
      return;
    }
    const batch = questions.map((question) => ({
      id: question.id,
      text: question.text,
      answer: textOf({ id: question.id }).trim(),
    }));
    setIsSending(true);
    setError(null);
    try {
      await answerOpenQuestions(sessionId, batch, first.createdByAgentId ?? null);
      setAnswers((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => !batch.some((sent) => sent.id === id)),
        ),
      );
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSending(false);
    }
  };

  if (first === undefined) {
    return null;
  }

  const submit = (
    <Button size="sm" type="submit" disabled={!canSend} isBusy={isSending}>
      {isMany ? ORCHESTRATED_COPY.questionsAnswerAction : ORCHESTRATED_COPY.questionAnswerAction}
    </Button>
  );

  const notice =
    error === null ? null : (
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
    );

  return (
    <form
      aria-label={
        isMany ? ORCHESTRATED_COPY.questionsAnswerLabel : ORCHESTRATED_COPY.questionAnswerLabel
      }
      data-run-open-question={first.id}
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {isMany ? notice : null}
      {questions.map((question, index) => {
        const label = isMany
          ? ORCHESTRATED_COPY.questionNumberLabel({
              position: index + 1,
              total: questions.length,
            })
          : ORCHESTRATED_COPY.questionAnswerLabel;
        return (
          <div key={question.id} className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-1 px-2">
              <span className="text-meta text-faint-foreground">
                {ORCHESTRATED_COPY.questionAsks}
              </span>
              <Markdown text={question.text} className="text-read text-foreground" />
            </div>
            {index === 0 && !isMany ? notice : null}
            <PromptField
              kind="message"
              label={label}
              placeholder={label}
              value={textOf({ id: question.id })}
              onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
              onSubmit={() => void send()}
              isSubmitBlocked={!canSend}
              disabled={isSending}
              minRows={1}
              maxRows={6}
              actions={isMany ? undefined : submit}
            />
          </div>
        );
      })}
      {isMany ? <div className="flex min-w-0 justify-end">{submit}</div> : null}
    </form>
  );
};
