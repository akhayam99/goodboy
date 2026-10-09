import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button, Input, Markdown, formatError, tintClasses } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { launchKeyOf } from '../../store/slices/resolve/resolveLaunch';
import { AnswerOptionRow } from '../../shared/components/AnswerOptionRow';
import { ICON_SIZE } from '../../shared/components/conceptIcons';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import { useThreadQuestion } from './hooks/useThreadQuestion';
import { FIX_RUN_QUESTION_COPY } from './reviewFlowCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly row: ResolveQueueRow;
};

export const ResolverQuestionCard = ({ sessionId, row }: Props) => {
  const { threadId } = row.thread;
  const answerQuestions = useAppStore((s) => s.answerQuestions);
  const question = row.thread.question ?? null;
  const { open } = useThreadQuestion({ sessionId, threadId, question });
  const options = open?.suggestedAnswers ?? [];
  const recommended = open?.recommendedAnswer ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const [free, setFree] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = row.attempt;
  const selected = picked ?? recommended;
  const typed = free.trim();
  const answer = typed !== '' ? typed : (selected ?? '');
  const canSend = answer !== '' && attempt !== null && !isBusy;

  const send = async (): Promise<void> => {
    if (!canSend || attempt === null) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await answerQuestions({
        sessionId,
        launchId: launchKeyOf({ attempt }),
        answers: [{ threadId, answer }],
      });
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={FIX_RUN_QUESTION_COPY.title}
      data-testid="resolver-question"
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4 ring-1 ring-border-soft"
    >
      <h2 className="flex items-center gap-2 text-label text-foreground">
        <CircleHelp size={ICON_SIZE.control} aria-hidden className={tintClasses('warning').text} />
        {FIX_RUN_QUESTION_COPY.title}
      </h2>
      {question !== null && question !== '' && (
        <Markdown text={question} variant="preview" className="text-body text-muted-foreground" />
      )}
      {options.length > 0 && (
        <div
          role="radiogroup"
          aria-label={FIX_RUN_QUESTION_COPY.options}
          className="flex flex-col gap-2"
        >
          {options.map((option, index) => (
            <AnswerOptionRow
              key={option}
              label={option}
              keyHint={index + 1}
              selected={typed === '' && selected === option}
              recommended={option === recommended}
              onToggle={() => {
                setFree('');
                setPicked(option);
              }}
            />
          ))}
        </div>
      )}
      <Input
        value={free}
        placeholder={FIX_RUN_QUESTION_COPY.other}
        aria-label={FIX_RUN_QUESTION_COPY.other}
        onChange={(event) => setFree(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void send();
          }
        }}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="primary"
          isBusy={isBusy}
          disabled={!canSend}
          onClick={() => void send()}
        >
          {FIX_RUN_QUESTION_COPY.continue}
        </Button>
        <span className="text-meta text-muted-foreground">{FIX_RUN_QUESTION_COPY.hint}</span>
      </div>
      {error !== null && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
