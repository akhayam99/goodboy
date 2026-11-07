import { EmptyLine } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { SpawnedAutoGroup } from './SpawnedAutoGroup';
import { SpawnedTree } from './SpawnedTree';
import { useAutoSpawnedRows } from './useAutoSpawnedRows';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAutoFocus = ({ sessionId, rootAgentId, selectedAgentId }: Props) => {
  const { rows } = useAutoSpawnedRows({ sessionId, rootAgentId });
  const hasChildren = rows.some((row) => row.level > 1);
  return (
    <>
      <SpawnedTree label="Auto agents">
        <SpawnedAutoGroup
          sessionId={sessionId}
          rootAgentId={rootAgentId}
          selectedAgentId={selectedAgentId}
          isAlwaysOpen
        />
      </SpawnedTree>
      {hasChildren ? null : <EmptyLine className="px-2">No agents started yet</EmptyLine>}
    </>
  );
};
