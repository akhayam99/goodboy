import { useMemo, useState } from 'react';
import { Button, Markdown, Notice, formatError } from '@goodboy/ui';
import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { OpenQuestionDeliveryError } from '../../../store/slices/open-questions/openQuestionDeliveryError';
import { PromptField } from '../../../shared/components/PromptField';
import { NAMES } from '../../../shared/utils/names';
import {
  QUESTION_DELEGATE_COPY,
  partitionDelegatedQuestions,
} from '../../context/questionDelegate';
import { ORCHESTRATED_COPY } from '../../workflows/orchestratedCopy';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

type ClearParams = {
  readonly sentIds: ReadonlyArray<string>;
};

type TextParams = {
  readonly id: string;
};

export const RunOpenQuestion = ({ sessionId, questions }: Props) => {
  const answerOpenQuestions = useAppStore((state) => state.answerOpenQuestions);
  const agents = useAppStore((state) => state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { waiting, answerable } = useMemo(
    () => partitionDelegatedQuestions({ questions, agents }),
    [questions, agents],
  );
  const waitingIds = useMemo(() => new Set(waiting.map((question) => question.id)), [waiting]);
  const first = questions[0];
  const isMany = answerable.length > 1;
  const textOf = ({ id }: TextParams): string => answers[id] ?? '';
  const canSend =
    answerable.length > 0 &&
    answerable.every((question) => textOf({ id: question.id }).trim() !== '') &&
    !isSending;

  const clearSent = ({ sentIds }: ClearParams): void => {
    setAnswers((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => !sentIds.includes(id))),
    );
  };

  const send = async (): Promise<void> => {
    const asking = answerable[0];
    if (!canSend || asking === undefined) {
      return;
    }
    const batch = answerable.map((question) => ({
      id: question.id,
      text: question.text,
      answer: textOf({ id: question.id }).trim(),
    }));
    const sentIds = batch.map((sent) => sent.id);
    setIsSending(true);
    setError(null);
    try {
      await answerOpenQuestions(sessionId, batch, asking.createdByAgentId ?? null);
      clearSent({ sentIds });
    } catch (cause) {
      if (cause instanceof OpenQuestionDeliveryError) {
        clearSent({ sentIds });
        return;
      }
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
        isMany || (answerable.length === 0 && questions.length > 1)
          ? ORCHESTRATED_COPY.questionsAnswerLabel
          : ORCHESTRATED_COPY.questionAnswerLabel
      }
      data-run-open-question={first.id}
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {isMany ? notice : null}
      {questions.map((question) => {
        const position = answerable.findIndex((candidate) => candidate.id === question.id);
        const label = isMany
          ? ORCHESTRATED_COPY.questionNumberLabel({
              position: position + 1,
              total: answerable.length,
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
            {waitingIds.has(question.id) ? (
              <p
                data-run-question-waiting={question.id}
                className="px-2 text-ui text-muted-foreground"
              >
                {QUESTION_DELEGATE_COPY.running}
              </p>
            ) : (
              <>
                {position === 0 && !isMany ? notice : null}
                <PromptField
                  kind="message"
                  label={label}
                  placeholder={label}
                  value={textOf({ id: question.id })}
                  onChange={(value) =>
                    setAnswers((current) => ({ ...current, [question.id]: value }))
                  }
                  onSubmit={() => void send()}
                  isSubmitBlocked={!canSend}
                  disabled={isSending}
                  minRows={1}
                  maxRows={6}
                  actions={isMany ? undefined : submit}
                />
              </>
            )}
          </div>
        );
      })}
      {isMany ? <div className="flex min-w-0 justify-end">{submit}</div> : null}
    </form>
  );
};
