import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { PromptField } from '../../../../shared/components/PromptField';
import { useAppStore } from '../../../../store';
import { launchKeyOf } from '../../../../store/slices/resolve/resolveLaunch';
import { OUTCOME_ACTION } from '../../commentOutcomeCopy';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { useOutcomeRun } from './useOutcomeRun';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly text: string;
  readonly isNote: boolean;
};

export const OutcomeQuestion = ({ sessionId, entry, text, isNote }: Props) => {
  const answerQuestions = useAppStore((s) => s.answerQuestions);
  const refuseResolveQueueItem = useAppStore((s) => s.refuseResolveQueueItem);
  const publishThreadNow = useAppStore((s) => s.publishThreadNow);
  const [answer, setAnswer] = useState('');
  const { isBusy, error, run } = useOutcomeRun();
  const { attempt, item, thread } = entry.row;
  const canAnswer = attempt !== null && answer.trim() !== '';

  const send = async (): Promise<void> => {
    if (attempt === null) {
      return;
    }
    await answerQuestions({
      sessionId,
      launchId: launchKeyOf({ attempt }),
      answers: [{ threadId: entry.threadId, answer }],
    });
    setAnswer('');
  };

  const askOnHost = async (): Promise<void> => {
    await refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: thread.revision,
      reply: text,
    });
    await publishThreadNow({ sessionId, threadId: entry.threadId });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-body text-foreground">{text}</p>
      <PromptField
        kind="document"
        label={OUTCOME_ACTION.answerField}
        value={answer}
        minRows={2}
        maxRows={4}
        disabled={isBusy}
        onChange={setAnswer}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          isBusy={isBusy}
          disabled={!canAnswer}
          onClick={() => void run(send)}
        >
          {OUTCOME_ACTION.answer}
        </Button>
        {!isNote && (
          <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void run(askOnHost)}>
            {OUTCOME_ACTION.askOnHost}
          </Button>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
