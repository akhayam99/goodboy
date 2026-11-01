import type { SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { heldAnswerCountOf } from '../../../workflows/heldAnswerCount';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: Pick<WorkflowRun, 'id' | 'orchestrationStop'>;
};

const NO_ANSWERS: ReadonlyArray<never> = [];

export const RunHeldAnswers = ({ sessionId, run }: Props) => {
  const answered = useAppStore((state) => state.sessionAnsweredQuestions[sessionId] ?? NO_ANSWERS);
  const count = heldAnswerCountOf({ run, answered });
  if (count === 0) {
    return null;
  }
  return (
    <p data-run-held-answers={count} className="px-2 text-ui text-muted-foreground">
      {ORCHESTRATED_COPY.heldAnswers({ count })}
    </p>
  );
};
