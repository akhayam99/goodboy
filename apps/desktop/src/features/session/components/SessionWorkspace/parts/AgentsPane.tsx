import type { ReactNode } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { createAgentEventName } from '../../../hooks/useTrailMenus';
import { StandaloneAgentsLane } from '../../StandaloneAgentsLane';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { WorkflowAutorunToggle } from '../../../../workflows/components/WorkflowAutorunToggle';
import { useAppStore } from '../../../../../store/store';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
};

export const AgentsPane = ({ session, meta }: Props) => {
  const sessionId = session.id as SessionId;
  const autoRun = useAppStore((s) => s.sessions.find((c) => c.id === sessionId)?.autoRun === true);
  const setSessionAutoRun = useAppStore((s) => s.setSessionAutoRun);

  return (
    <PaneShell
      title="Agents"
      meta={meta}
      actions={
        <>
          <WorkflowAutorunToggle
            isOn={autoRun}
            onToggle={() => void setSessionAutoRun(sessionId, !autoRun)}
          />
          <CreateAgentPopover sessionId={sessionId} openEvent={createAgentEventName(sessionId)} />
        </>
      }
    >
      <StandaloneAgentsLane session={session} variant="lens" showCompleted />
    </PaneShell>
  );
};
