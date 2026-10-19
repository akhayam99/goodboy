import { EmptyLine } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAutoTreeRows } from '../../../features/auto/useAutoTreeRows';
import { SpawnedAutoGroup } from './SpawnedAutoGroup';
import { SpawnedTree } from './SpawnedTree';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAutoFocus = ({ sessionId, rootAgentId, selectedAgentId }: Props) => {
  const model = useAutoTreeRows({ sessionId, agentId: rootAgentId });
  const hasChildren = model.rows.length > 1;
  return (
    <>
      <SpawnedTree label="Auto agents">
        <SpawnedAutoGroup
          sessionId={sessionId}
          rootAgentId={rootAgentId}
          selectedAgentId={selectedAgentId}
        />
      </SpawnedTree>
      {hasChildren ? null : <EmptyLine className="px-2">No agents started yet</EmptyLine>}
    </>
  );
};
