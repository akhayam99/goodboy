import type { AgentId, SessionId } from '@goodboy/types';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { openSpawned } from '../../../features/session/openSpawned';
import type { SpawnedRow } from './spawnedRow';
import { SpawnedStateRow } from './SpawnedStateRow';

type Props = {
  readonly sessionId: SessionId;
  readonly row: SpawnedRow;
  readonly parent: SpawnedRow | null;
  readonly isWorking: boolean;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedStateRowItem = ({
  sessionId,
  row,
  parent,
  isWorking,
  selectedAgentId,
}: Props) => (
  <ObjectMenuArea
    target={{ kind: 'agent', sessionId, agentId: row.agentId }}
    anchorKey={`spawned:${row.id}`}
  >
    <SpawnedStateRow
      row={row}
      fromRole={parent === null || parent.level === 1 ? null : parent.role}
      isWorking={isWorking}
      isSelected={row.agentId === selectedAgentId}
      onOpen={() =>
        openSpawned({
          sessionId,
          target: { kind: 'agent', agentId: row.agentId },
        })
      }
    />
  </ObjectMenuArea>
);
