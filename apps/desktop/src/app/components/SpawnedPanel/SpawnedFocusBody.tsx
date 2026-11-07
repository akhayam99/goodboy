import { EmptyLine } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';

import { useAttachedWorkflowRuns } from '../../../features/workflows/useAttachedWorkflowRuns';
import { RunIdentityRow } from './RunIdentityRow';
import type { SpawnedFocus } from './spawnedFocus';
import { SpawnedAutoFocus } from './SpawnedAutoFocus';
import { SpawnedRunGroup } from './SpawnedRunGroup';
import { SpawnedTree } from './SpawnedTree';

type Props = {
  readonly session: Session;
  readonly focus: SpawnedFocus;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedFocusBody = ({ session, focus, selectedAgentId }: Props) => {
  const attached = useAttachedWorkflowRuns({ session });
  if (focus.kind === 'auto') {
    return (
      <SpawnedAutoFocus
        sessionId={session.id}
        rootAgentId={focus.rootAgentId}
        selectedAgentId={selectedAgentId}
      />
    );
  }
  const found = attached.find(({ run }) => run.id === focus.runId) ?? null;
  if (found === null) {
    return <EmptyLine className="px-2">This run is gone</EmptyLine>;
  }
  const { run, workflow } = found;
  return (
    <>
      <RunIdentityRow session={session} run={run} workflow={workflow} />
      <SpawnedTree label="Run agents">
        <SpawnedRunGroup
          session={session}
          run={run}
          workflow={workflow}
          isHeaded={false}
          selectedAgentId={selectedAgentId}
        />
      </SpawnedTree>
    </>
  );
};
