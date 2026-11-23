import type { AgentId, SessionId } from '@goodboy/types';
import type { DeskAgentEntry } from '../../store/slices/drawer/deskStackOf';
import { DeskAgent } from '../../features/chat/components/DeskAgent';
import { useWorkOf } from '../../features/live-state/hooks/useWorkOf';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly focus: DeskAgentEntry['payload'];
  readonly onClose: () => void;
};

export const DeskAgentPanel = ({ sessionId, agentId, focus, onClose }: Props) => {
  const { work } = useWorkOf({ sessionId });
  const phrase = work.find((row) => row.agentId === agentId)?.phrase ?? null;
  return (
    <DeskAgent
      sessionId={sessionId}
      agentId={agentId}
      focus={focus}
      onClose={onClose}
      phrase={phrase}
    />
  );
};
