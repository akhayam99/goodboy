import type { OpenQuestion, SessionId } from '@goodboy/types';
import { OpenQuestionCluster } from '../../../chat/openQuestionSurfaces';

type Props = {
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

export const RunOpenQuestion = ({ sessionId, questions }: Props) => {
  const first = questions[0];
  if (first === undefined) {
    return null;
  }
  return (
    <div data-run-open-question={first.id} className="min-w-0">
      <OpenQuestionCluster questions={questions} sessionId={sessionId} />
    </div>
  );
};
