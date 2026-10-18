import { PaneShell } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { createAgentEventName } from '../../../createAgentEventName';
import { AgentsGrid } from '../../AgentsGrid';
import { SessionPageIntro } from '../../SessionPageIntro';
import { NAMES } from '../../../../../shared/names';

type Props = {
  readonly session: Session;
};

export const AgentsPane = ({ session }: Props) => {
  const sessionId: SessionId = session.id;

  return (
    <PaneShell
      page="agents"
      title={NAMES.agents}
      subheader={<SessionPageIntro page="agents" />}
      actions={
        <CreateAgentPopover sessionId={sessionId} openEvent={createAgentEventName(sessionId)} />
      }
    >
      <AgentsGrid session={session} />
    </PaneShell>
  );
};
