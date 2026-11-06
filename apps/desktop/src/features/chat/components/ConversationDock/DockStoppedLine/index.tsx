import type { AgentId, SessionId } from '@goodboy/types';
import { DockStateLine } from '../../../../../shared/components/DockStateLine';
import type { StoppedAnswer } from '../../../../../store/slices/permissions/stoppedAnswerOf';
import { DockContinueButton } from '../DockContinueButton';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly stopped: StoppedAnswer;
};

export const DockStoppedLine = ({ sessionId, agentId, stopped }: Props) => (
  <DockStateLine state="stopped-answer" tone="warning" sentence="Stopped before your answer">
    <DockContinueButton
      sessionId={sessionId}
      agentId={agentId}
      toolName={stopped.toolName}
      toolUseId={stopped.toolUseId}
    />
  </DockStateLine>
);
