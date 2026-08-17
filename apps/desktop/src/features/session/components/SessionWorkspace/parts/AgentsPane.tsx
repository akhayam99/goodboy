import type { AgentId, Session, SessionId } from '@goodboy/types';
import { AgentInspector } from '../../AgentInspector';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { StandaloneAgentsLane } from '../../StandaloneAgentsLane';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from '../../../../../shared/components/PaneShell';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly inspectedAgentId: AgentId | null;
  readonly onInspectAgent: (agentId: AgentId | null) => void;
};

export const AgentsPane = ({ session, meta, inspectedAgentId, onInspectAgent }: Props) => {
  const sessionId = session.id as SessionId;

  return (
    <InspectorSplit
      open={inspectedAgentId !== null}
      panel={
        inspectedAgentId !== null ? (
          <AgentInspector
            sessionId={sessionId}
            agentId={inspectedAgentId}
            onClose={() => onInspectAgent(null)}
          />
        ) : null
      }
    >
      <PaneShell
        title="Agents"
        description="Agents you spawn by hand to work this session."
        meta={meta}
        actions={<CreateAgentPopover sessionId={sessionId} variant="compact" />}
      >
        <StandaloneAgentsLane
          session={session}
          variant="lens"
          inspectedAgentId={inspectedAgentId}
          onInspectAgent={(agentId) => onInspectAgent(agentId)}
          showCompleted
        />
      </PaneShell>
    </InspectorSplit>
  );
};
