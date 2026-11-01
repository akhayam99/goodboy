import type { ReactNode } from 'react';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { OpenQuestionCluster } from '../../../chat/openQuestionSurfaces';

type Props = {
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly readOnlyAction?: ReactNode;
};

export const RunOpenQuestion = ({ sessionId, questions, readOnlyAction = null }: Props) => {
  const first = questions[0];
  if (first === undefined) {
    return null;
  }
  return (
    <div data-run-open-question={first.id} className="flex min-w-0 flex-col gap-2">
      <OpenQuestionCluster
        questions={questions}
        sessionId={sessionId}
        readOnlyAction={readOnlyAction}
      />
    </div>
  );
};
