import { useMemo } from 'react';
import { EmptyLine } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { autoRootsOf } from '../../../features/auto/autoRootsOf';
import { useAttachedWorkflowRuns } from '../../../features/workflows/useAttachedWorkflowRuns';
import { launchesOf } from './launchesOf';
import { SpawnedAutoGroup } from './SpawnedAutoGroup';
import { SpawnedRunGroup } from './SpawnedRunGroup';
import { SpawnedTree } from './SpawnedTree';

type Props = {
  readonly session: Session;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedLaunches = ({ session, selectedAgentId }: Props) => {
  const sessionId = session.id;
  const attached = useAttachedWorkflowRuns({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const roots = useMemo(() => autoRootsOf({ agents, kindOverride }), [agents, kindOverride]);
  const launches = useMemo(() => launchesOf({ attached, roots }), [attached, roots]);
  if (launches.length === 0) {
    return <EmptyLine className="px-2">Nothing launched yet</EmptyLine>;
  }
  return (
    <SpawnedTree label="Launches">
      {launches.map((launch) =>
        launch.kind === 'run' ? (
          <SpawnedRunGroup
            key={launch.id}
            session={session}
            run={launch.run}
            workflow={launch.workflow}
            isHeaded
            selectedAgentId={selectedAgentId}
          />
        ) : (
          <SpawnedAutoGroup
            key={launch.id}
            sessionId={sessionId}
            rootAgentId={launch.rootAgentId}
            selectedAgentId={selectedAgentId}
          />
        ),
      )}
    </SpawnedTree>
  );
};
