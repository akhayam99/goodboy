import type { ReactNode } from 'react';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { OpenQuestionCluster } from '../../../chat/openQuestionSurfaces';

type RunQuestionsReadOnly = {
  readonly hint: string;
  readonly action: ReactNode;
};

type Props = {
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly readOnly?: RunQuestionsReadOnly | null;
};

export const RunOpenQuestion = ({ sessionId, questions, readOnly = null }: Props) => {
  const first = questions[0];
  if (first === undefined) {
    return null;
  }
  return (
    <div data-run-open-question={first.id} className="flex min-w-0 flex-col gap-2">
      <OpenQuestionCluster
        questions={questions}
        sessionId={sessionId}
        isReadOnly={readOnly !== null}
      />
      {readOnly === null ? null : (
        <div data-run-questions-hint="" className="flex min-w-0 items-center gap-2 px-2 text-ui">
          <span className="min-w-0 text-muted-foreground">{readOnly.hint}</span>
          {readOnly.action}
        </div>
      )}
    </div>
  );
};
