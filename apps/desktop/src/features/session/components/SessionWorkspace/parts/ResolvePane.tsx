import type { AgentId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ResolverAgentsLane } from '../../ResolverAgentsLane';
import { PaneShell } from '../../../../../shared/components/PaneShell';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId | null) => void;
};

export const ResolvePane = ({ session, meta, inspectedResolverId, onInspectResolver }: Props) => {
  const sessionId = session.id as SessionId;
  const selectAgent = useAppStore((s) => s.selectAgent);

  return (
    <PaneShell
      title="Resolve"
      description="Resolver agents spawned from pull request comments and diff selections."
      meta={meta}
    >
      <ResolverAgentsLane
        session={session}
        inspectedResolverId={inspectedResolverId}
        onInspectResolver={(agentId) => {
          onInspectResolver(agentId);
          void selectAgent(sessionId, agentId);
        }}
        showCompleted
      />
    </PaneShell>
  );
};
