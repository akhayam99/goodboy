import { useState } from 'react';
import { Button, FormActions, KbdPill, formatError, useEscapeLayer } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { REVIEW_BULK_LABEL, answersContinueLabel, answersTitle } from '../../../reviewBulkCopy';
import type { BulkRun } from '../bulkRun';
import type { BulkQuestion } from '../bulkQuestions';
import { AnswerCard } from './AnswerCard';

type Props = {
  readonly sessionId: SessionId;
  readonly run: BulkRun;
  readonly questions: ReadonlyArray<BulkQuestion>;
  readonly onClose: () => void;
  readonly onContinued: () => void;
};

export const AnswersPanel = ({ sessionId, run, questions, onClose, onContinued }: Props) => {
  const answerQuestions = useAppStore((s) => s.answerQuestions);
  const [picked, setPicked] = useState<Readonly<Record<string, string>>>({});
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = questions.filter((question) => !dropped.has(question.threadId));

  useEscapeLayer(onClose);

  const setDrop = ({
    threadId,
    isDropped,
  }: {
    readonly threadId: string;
    readonly isDropped: boolean;
  }) =>
    setDropped((current) =>
      isDropped
        ? new Set([...current, threadId])
        : new Set([...current].filter((id) => id !== threadId)),
    );

  const submit = async (): Promise<void> => {
    if (isContinuing || live.length === 0) {
      return;
    }
    setIsContinuing(true);
    setError(null);
    try {
      await answerQuestions({
        sessionId,
        launchId: run.launchId,
        answers: live.map((question) => ({
          threadId: question.threadId,
          answer: picked[question.threadId] ?? question.recommended,
        })),
      });
      onContinued();
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <section
      aria-label={REVIEW_BULK_LABEL.answersPanel}
      className="flex min-w-0 max-w-[640px] flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-title text-foreground">{answersTitle({ count: questions.length })}</h2>
        <p className="text-meta text-muted-foreground">{REVIEW_BULK_LABEL.answersLine}</p>
      </div>
      <div className="flex flex-col gap-2">
        {questions.map((question) => (
          <AnswerCard
            key={question.threadId}
            question={question}
            chosen={picked[question.threadId] ?? question.recommended}
            isDropped={dropped.has(question.threadId)}
            onChoose={(answer) =>
              setPicked((current) => ({ ...current, [question.threadId]: answer }))
            }
            onDrop={() => setDrop({ threadId: question.threadId, isDropped: true })}
            onUndoDrop={() => setDrop({ threadId: question.threadId, isDropped: false })}
          />
        ))}
      </div>
      <FormActions error={error}>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {REVIEW_BULK_LABEL.cancel}
          <KbdPill aria-hidden className="h-4 min-w-4 text-chip">
            Esc
          </KbdPill>
        </Button>
        <Button
          size="sm"
          variant="primary"
          isBusy={isContinuing}
          disabled={live.length === 0}
          onClick={() => void submit()}
        >
          {answersContinueLabel({ count: live.length })}
        </Button>
      </FormActions>
    </section>
  );
};
