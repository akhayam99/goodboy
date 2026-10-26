import { useMemo } from 'react';
import { EmptyLine } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import { useAttachedWorkflowRuns } from '../../../features/workflows/useAttachedWorkflowRuns';
import { useSessionRuns } from '../../../features/session/hooks/useSessionRuns';
import { launchesOf } from './launchesOf';
import { SpawnedAgentGroup } from './SpawnedAgentGroup';
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
  const runs = useSessionRuns({ session });
  const launches = useMemo(() => launchesOf({ runs, attached }), [runs, attached]);
  if (launches.length === 0) {
    return <EmptyLine className="px-2">No agents in this session yet</EmptyLine>;
  }
  return (
    <SpawnedTree label="Launches">
      {launches.map((launch) => {
        switch (launch.kind) {
          case 'run':
            return (
              <SpawnedRunGroup
                key={launch.id}
                session={session}
                run={launch.run}
                workflow={launch.workflow}
                isHeaded
                selectedAgentId={selectedAgentId}
              />
            );
          case 'auto':
            return (
              <SpawnedAutoGroup
                key={launch.id}
                sessionId={sessionId}
                rootAgentId={launch.rootAgentId}
                selectedAgentId={selectedAgentId}
              />
            );
          case 'agent':
            return (
              <SpawnedAgentGroup
                key={launch.id}
                sessionId={sessionId}
                agentId={launch.agentId}
                selectedAgentId={selectedAgentId}
              />
            );
          default: {
            const unreachable: never = launch;
            return unreachable;
          }
        }
      })}
    </SpawnedTree>
  );
};
