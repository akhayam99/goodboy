import type { AgentId, SessionId } from '@goodboy/types';
import type { useTurnRouting } from '../hooks/useTurnRouting';
import { WriterWaitBand } from '../../WriteDestinationControl/WriterWaitBand';
import { ComposerCliGate } from './ComposerCliGate';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly routing: ReturnType<typeof useTurnRouting>;
};

export const ComposerGates = ({ sessionId, agentId, routing }: Props) => (
  <>
    <ComposerCliGate provider={routing.effectiveProvider} modelId={routing.effectiveModelId} />
    <WriterWaitBand sessionId={sessionId} agentId={agentId} />
  </>
);
