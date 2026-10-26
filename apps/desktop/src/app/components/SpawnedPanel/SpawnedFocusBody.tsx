import { Plus } from 'lucide-react';
import { Button, EmptyLine, ICON_SIZE } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';

import { requestRunAddStep } from '../../../features/workflows/requestRunAddStep';
import { useAttachedWorkflowRuns } from '../../../features/workflows/useAttachedWorkflowRuns';
import { openSpawned } from '../../../features/session/openSpawned';
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
  const isAddable = run.discardedAt == null && run.executionMode !== 'dynamic';
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
      {isAddable ? (
        <div data-run-add-step="" className="flex">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              openSpawned({ sessionId: session.id, target: { kind: 'run', runId: run.id } });
              requestRunAddStep({ runId: run.id });
            }}
          >
            <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            Add step
          </Button>
        </div>
      ) : null}
    </>
  );
};
