import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { CountToggle } from '@goodboy/ui';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { ResolverAgentsLane } from '../../ResolverAgentsLane';
import { AgentInspector } from '../../AgentInspector';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from '../../../../../shared/components/PaneShell';

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
      >
        <ResolverAgentsLane
          session={session}
          inspectedResolverId={inspectedResolverId}
          onInspectResolver={(agentId) => onInspectResolver(agentId)}
          showCompleted={showCompleted}
          onCompletedCountChange={setCompletedCount}
          filedToggle={
            <div className="flex justify-center">
              <CountToggle
                label="Completed"
                itemsLabel="resolvers"
                count={completedCount}
                isShown={showCompleted}
                icon={CircleCheck}
                onChange={onShowCompletedChange}
              />
            </div>
          }
        />
      </PaneShell>
    </InspectorSplit>
  );
};
