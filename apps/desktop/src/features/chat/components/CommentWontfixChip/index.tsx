import type { AgentId, SessionId } from '@goodboy/types';
import { CommentMarkerChip } from '../CommentMarkerChip';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

export const CommentWontfixChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  return (
    <CommentMarkerChip
      assistantText={assistantText}
      sessionId={sessionId}
      agentId={agentId}
      kind="wontfix"
    />
  );
};
