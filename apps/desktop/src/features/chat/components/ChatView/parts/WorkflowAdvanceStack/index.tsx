import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { StepEndedNotice } from '../../../../../workflows/StepEndedNotice';
import { ConversationColumn } from '../../../ConversationColumn';
import { WorkflowAdvanceRow } from '../WorkflowAdvanceRow';

type Props = {
  readonly session: Session;
};

export const WorkflowAdvanceStack = ({ session }: Props) => {
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[session.id] ?? null);
  return (
    <>
      {selectedAgentId === null ? null : (
        <ConversationColumn className="shrink-0 pb-1 empty:hidden">
          <StepEndedNotice sessionId={session.id} agentId={selectedAgentId} />
        </ConversationColumn>
      )}
      <WorkflowAdvanceRow session={session} />
    </>
  );
};
