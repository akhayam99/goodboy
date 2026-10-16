import { PaneShell } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { createAgentEventName } from '../../../createAgentEventName';
import { AgentsGrid } from '../../AgentsGrid';
import { WorkflowAutorunToggle } from '../../../../workflows/components/WorkflowAutorunToggle';
import { useAppStore } from '../../../../../store/store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
};

export const AgentsPane = ({ session, meta }: Props) => {
  const sessionId: SessionId = session.id;
  const autoRun = useAppStore((s) => sessionById(s.sessions, sessionId)?.autoRun === true);
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
      <AgentsGrid session={session} />
    </PaneShell>
  );
};
