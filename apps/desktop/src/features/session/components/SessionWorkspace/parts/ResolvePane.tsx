import type { AgentId, Session, SessionId } from '@goodboy/types';
import { ResolverAgentsLane } from '../../ResolverAgentsLane';
import { AgentInspector } from '../../AgentInspector';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from './PaneShell';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId | null) => void;
};

export const ResolvePane = ({ session, meta, inspectedResolverId, onInspectResolver }: Props) => {
  const sessionId = session.id as SessionId;

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
        width="3xl"
      >
        <ResolverAgentsLane
          session={session}
          inspectedResolverId={inspectedResolverId}
          onInspectResolver={(agentId) => onInspectResolver(agentId)}
        />
      </PaneShell>
    </InspectorSplit>
  );
};
