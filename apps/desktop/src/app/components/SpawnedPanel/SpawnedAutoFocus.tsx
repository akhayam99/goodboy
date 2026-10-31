import { useMemo } from 'react';
import { EmptyLine } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { SpawnedStateGroups } from './SpawnedStateGroups';
import { SpawnedTree } from './SpawnedTree';
import { spawnedStateGroupsOf } from './spawnedStateGroupsOf';
import { spawnedStateSummaryOf } from './spawnedStateSummaryOf';
import { useAutoSpawnedRows } from './useAutoSpawnedRows';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAutoFocus = ({ sessionId, rootAgentId, selectedAgentId }: Props) => {
  const { rows } = useAutoSpawnedRows({ sessionId, rootAgentId });
  const rootRow = useMemo(() => rows.find((row) => row.level === 1) ?? null, [rows]);
  const helperRows = useMemo(() => rows.filter((row) => row.level > 1), [rows]);
  const groups = useMemo(() => spawnedStateGroupsOf({ rows: helperRows }), [helperRows]);
  const hasChildren = helperRows.length > 0;
  return (
    <>
      {groups.length === 0 ? null : (
        <p data-spawned-summary="" className="px-2 text-meta text-muted-foreground">
          {spawnedStateSummaryOf({ groups })}
        </p>
      )}
      <SpawnedTree label="Auto agents" hasNow={false} order="parent-first">
        <SpawnedStateGroups
          sessionId={sessionId}
          rows={rows}
          rootRow={rootRow}
          groups={groups}
          selectedAgentId={selectedAgentId}
        />
      </SpawnedTree>
      {hasChildren ? null : <EmptyLine className="px-2">No agents started yet</EmptyLine>}
    </>
  );
};
