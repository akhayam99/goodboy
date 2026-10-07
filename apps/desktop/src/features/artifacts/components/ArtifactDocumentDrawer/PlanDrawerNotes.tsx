import { Button, Notice } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { OpenQuestionCluster } from '../../../chat/openQuestionSurfaces';

type Props = {
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly isUnchanged: boolean;
  readonly onOpenReply: () => void;
};

export const PlanDrawerNotes = ({ sessionId, questions, isUnchanged, onOpenReply }: Props) => (
  <>
    {questions.length === 0 ? null : (
      <div data-testid="plan-drawer-question" className="min-w-0">
        <OpenQuestionCluster questions={questions} sessionId={sessionId} />
      </div>
    )}
    {isUnchanged ? (
      <Notice
        tone="info"
        placement="inline"
        role="status"
        title="The planner answered without changing the plan"
        actions={
          <Button variant="secondary" size="xs" onClick={onOpenReply}>
            Open the reply
          </Button>
        }
      />
    ) : null}
  </>
);
