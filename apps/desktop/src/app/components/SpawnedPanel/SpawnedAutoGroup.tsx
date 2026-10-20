import { useMemo } from 'react';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { DelegationClock } from '../../../features/auto/chat/DelegationClock';
import { useAutoTreeRows } from '../../../features/auto/useAutoTreeRows';
import { autoSpawnedRowsOf } from './autoSpawnedRowsOf';
import { openSpawned } from '../../../features/session/openSpawned';
import { SpawnedTreeRow } from './SpawnedTreeRow';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAutoGroup = ({ sessionId, rootAgentId, selectedAgentId }: Props) => {
  const model = useAutoTreeRows({ sessionId, agentId: rootAgentId });
  const rows = useMemo(() => autoSpawnedRowsOf({ rows: model.rows, baseLevel: 1 }), [model.rows]);
  return (
    <>
      {rows.map((row) => (
        <SpawnedTreeRow
          key={row.id}
          id={row.id}
          level={row.level}
          hasChildren={row.hasChildren}
          glyph={<WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />}
          role={row.role}
          title={row.title}
          detail={row.detail}
          word={row.word}
          time={<DelegationClock agentId={row.agentId} isLive={row.isLive} />}
          isSelected={row.agentId === selectedAgentId}
          onOpen={() =>
            openSpawned({
              sessionId,
              target:
                row.level === 1
                  ? { kind: 'auto-root', agentId: row.agentId }
                  : { kind: 'auto-child', agentId: row.agentId },
            })
          }
        />
      ))}
    </>
  );
};
