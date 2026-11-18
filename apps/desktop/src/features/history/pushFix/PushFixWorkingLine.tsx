import type { AgentId, SessionId } from '@goodboy/types';
import { PushFixStatusLine } from './PushFixStatusLine';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const PushFixWorkingLine = ({ sessionId, agentId }: Props) =>
  agentId === null ? null : (
    <PushFixStatusLine sessionId={sessionId} state={{ kind: 'working', agentId }} />
  );
