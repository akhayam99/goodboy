import { useState } from 'react';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { ShowCompletedToggle } from '../../AgentLane/ShowCompletedToggle';
import { ResolverAgentsLane } from '../../ResolverAgentsLane';
import { AgentInspector } from '../../AgentInspector';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { WorkSurfaceBackButton } from '../../../../../shared/components/WorkSurfaceBackButton';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId | null) => void;
  readonly showCompleted: boolean;
  readonly onShowCompletedChange: (showCompleted: boolean) => void;
};

export const ResolvePane = ({
  session,
  meta,
  inspectedResolverId,
  onInspectResolver,
  showCompleted,
  onShowCompletedChange,
}: Props) => {
  const sessionId = session.id as SessionId;
  const [completedCount, setCompletedCount] = useState(0);

  return (
    <InspectorSplit
      open={inspectedResolverId !== null}
      panel={
        inspectedResolverId !== null ? (
          <AgentInspector
            sessionId={sessionId}
            agentId={inspectedResolverId}
            onClose={() => onInspectResolver(null)}
          />
        ) : null
      }
    >
      <PaneShell
        title="Resolve"
        description="Resolver agents spawned from pull request comments and diff selections."
        meta={meta}
        actions={
          <>
            <WorkSurfaceBackButton sessionId={sessionId} />
            <ShowCompletedToggle
              completedCount={completedCount}
              isShown={showCompleted}
              onChange={onShowCompletedChange}
            />
          </>
        }
      >
        <ResolverAgentsLane
          session={session}
          inspectedResolverId={inspectedResolverId}
          onInspectResolver={(agentId) => onInspectResolver(agentId)}
          showCompleted={showCompleted}
          onCompletedCountChange={setCompletedCount}
        />
      </PaneShell>
    </InspectorSplit>
  );
};
