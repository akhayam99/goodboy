import type { AgentId, Session, SessionId } from '@goodboy/types';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { AgentInspector } from '../../AgentInspector';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from './PaneShell';

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
        width="3xl"
      >
        <AgentsSection
          task={session}
          only="agents"
          inspectedAgentId={inspectedAgentId}
          onInspectAgent={(agentId) => onInspectAgent(agentId)}
        />
      </PaneShell>
    </InspectorSplit>
  );
};
