import { useState } from 'react';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { AgentInspector } from '../../AgentInspector';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { ShowCompletedToggle } from '../../AgentLane/ShowCompletedToggle';
import { StandaloneAgentsLane } from '../../StandaloneAgentsLane';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from './PaneShell';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly inspectedAgentId: AgentId | null;
  readonly onInspectAgent: (agentId: AgentId | null) => void;
  readonly showCompleted: boolean;
  readonly onShowCompletedChange: (showCompleted: boolean) => void;
};

export const AgentsPane = ({
  session,
  meta,
  inspectedAgentId,
  onInspectAgent,
  showCompleted,
  onShowCompletedChange,
}: Props) => {
  const sessionId = session.id as SessionId;
  const [completedCount, setCompletedCount] = useState(0);

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
        actions={
          <>
            <ShowCompletedToggle
              completedCount={completedCount}
              isShown={showCompleted}
              onChange={onShowCompletedChange}
            />
            <CreateAgentPopover sessionId={sessionId} variant="compact" />
          </>
        }
      >
        <StandaloneAgentsLane
          session={session}
          variant="lens"
          inspectedAgentId={inspectedAgentId}
          onInspectAgent={(agentId) => onInspectAgent(agentId)}
          showCompleted={showCompleted}
          onCompletedCountChange={setCompletedCount}
        />
      </PaneShell>
    </InspectorSplit>
  );
};
